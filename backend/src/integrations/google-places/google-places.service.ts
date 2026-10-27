import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/*
 * Điểm và đánh giá Google Maps của nhà cung cấp qua Places API (New).
 * CSDL chỉ có vendor_profiles.google_maps_url (link tìm kiếm tên + địa chỉ), không có PlaceId hay điểm:
 * tìm PlaceId bằng Text Search từ link đó, rồi lấy điểm. Theo điều khoản Google Maps Platform chỉ PlaceId
 * được giữ lâu; điểm và đánh giá chỉ cache ngắn trong bộ nhớ, không ghi vào CSDL.
 */

const API = 'https://places.googleapis.com/v1';
const RATING_TTL_MS = 10 * 60_000;
/** Không tìm thấy địa điểm thì nhớ ngắn hơn để thử lại khi NCC sửa link */
const MISS_TTL_MS = 30 * 60_000;

export type GoogleRatingMode = 'summary' | 'reviews';

export interface GoogleReview {
  authorName: string;
  authorUri?: string;
  authorPhotoUri?: string;
  rating: number;
  text: string;
  publishTime: string;
  relativeTime?: string;
  languageCode?: string;
}

export interface GoogleRating {
  placeId: string;
  rating: number | null;
  userRatingCount: number;
  googleMapsUri: string;
  reviews?: GoogleReview[];
  reviewsSortedBy?: 'relevance';
}

interface PlaceResponse {
  id: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    text?: { text?: string; languageCode?: string };
    originalText?: { text?: string; languageCode?: string };
    publishTime?: string;
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
}

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

/** Chuỗi tìm kiếm trong link Google Maps (?query=… hoặc /maps/search/…/, /maps/place/…/). */
export function queryFromMapsUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const q = u.searchParams.get('query') ?? u.searchParams.get('q');
    if (q?.trim()) return q.trim();
    const m = u.pathname.match(/\/maps\/(?:search|place)\/([^/@]+)/);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || null : null;
  } catch {
    return null;
  }
}

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly key = process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
  /** vendorId -> PlaceId (null: đã tìm mà không thấy) */
  private readonly placeIds = new Map<string, { placeId: string | null; at: number }>();
  private readonly ratings = new Map<string, { value: GoogleRating; at: number }>();

  constructor(private readonly prisma: PrismaService) {
    if (!this.key) this.logger.warn('Chưa có GOOGLE_MAPS_API_KEY trong backend/.env: API điểm Google trả 503.');
  }

  get configured() {
    return !!this.key;
  }

  private async call<T>(path: string, fieldMask: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method: init.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.key!, 'X-Goog-FieldMask': fieldMask },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      this.logger.error(`Gọi Google Places lỗi: ${(e as Error).message}`);
      return fail('GOOGLE_UNAVAILABLE', 'Không lấy được điểm Google Maps.', 502);
    }
    if (res.status === 429) return fail('GOOGLE_QUOTA_EXCEEDED', 'Đã vượt hạn mức gọi Google Maps.', 429);
    if (!res.ok) {
      this.logger.error(`Google Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return fail('GOOGLE_UNAVAILABLE', 'Không lấy được điểm Google Maps.', 502);
    }
    return (await res.json()) as T;
  }

  private async placeIdOf(vendorId: string): Promise<string | null> {
    const cached = this.placeIds.get(vendorId);
    if (cached && (cached.placeId || Date.now() - cached.at < MISS_TTL_MS)) return cached.placeId;

    const v = await this.prisma.vendor_profiles.findUnique({
      where: { id: vendorId },
      select: { business_name: true, address: true, ward: true, city: true, google_maps_url: true },
    });
    if (!v) return fail('VENDOR_NOT_FOUND', 'Không tìm thấy nhà cung cấp.', 404);

    // Link do NCC nhập; link rút gọn (maps.app.goo.gl) không đọc được tên thì tìm bằng tên + địa chỉ
    const textQuery = queryFromMapsUrl(v.google_maps_url) ?? [v.business_name, v.address, v.ward, v.city].filter(Boolean).join(' ');
    const data = await this.call<{ places?: { id: string }[] }>('/places:searchText', 'places.id', {
      method: 'POST',
      body: { textQuery, languageCode: 'vi', regionCode: 'VN', pageSize: 1 },
    });
    const placeId = data.places?.[0]?.id ?? null;
    this.placeIds.set(vendorId, { placeId, at: Date.now() });
    return placeId;
  }

  /** Điểm Google của NCC. Lỗi: 503 chưa cấu hình, 404 không tìm thấy địa điểm, 429 hết hạn mức, 502 Google lỗi. */
  async rating(vendorId: string, mode: GoogleRatingMode): Promise<GoogleRating> {
    if (!this.key) return fail('GOOGLE_NOT_CONFIGURED', 'Chưa cấu hình Google Maps.', 503);
    const cacheKey = `${vendorId}:${mode}`;
    const cached = this.ratings.get(cacheKey);
    if (cached && Date.now() - cached.at < RATING_TTL_MS) return cached.value;

    const placeId = await this.placeIdOf(vendorId);
    if (!placeId) return fail('GOOGLE_PLACE_NOT_FOUND', 'Không tìm thấy địa điểm trên Google Maps.', 404);

    const fields = ['id', 'rating', 'userRatingCount', 'googleMapsUri', ...(mode === 'reviews' ? ['reviews'] : [])].join(',');
    const p = await this.call<PlaceResponse>(`/places/${encodeURIComponent(placeId)}?languageCode=vi&regionCode=VN`, fields);

    const value: GoogleRating = {
      placeId: p.id,
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? 0,
      googleMapsUri: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    };
    if (mode === 'reviews') {
      value.reviewsSortedBy = 'relevance';
      value.reviews = (p.reviews ?? []).slice(0, 5).map((r) => ({
        authorName: r.authorAttribution?.displayName ?? 'Người dùng Google',
        authorUri: r.authorAttribution?.uri,
        authorPhotoUri: r.authorAttribution?.photoUri,
        rating: r.rating ?? 0,
        text: r.originalText?.text ?? r.text?.text ?? '',
        publishTime: r.publishTime ?? '',
        relativeTime: r.relativePublishTimeDescription,
        languageCode: r.originalText?.languageCode ?? r.text?.languageCode,
      }));
    }
    this.ratings.set(cacheKey, { value, at: Date.now() });
    // Bản reviews có đủ thông tin của summary
    if (mode === 'reviews') this.ratings.set(`${vendorId}:summary`, { value: { ...value, reviews: undefined, reviewsSortedBy: undefined }, at: Date.now() });
    return value;
  }

  /** Điểm dạng số cho phần đề xuất; null khi thiếu (chưa cấu hình, không thấy địa điểm, Google lỗi). */
  async ratingOrNull(vendorId: string): Promise<{ rating: number; reviewCount: number } | null> {
    if (!this.key) return null;
    try {
      const r = await this.rating(vendorId, 'summary');
      return r.rating === null ? null : { rating: r.rating, reviewCount: r.userRatingCount };
    } catch {
      return null;
    }
  }
}
