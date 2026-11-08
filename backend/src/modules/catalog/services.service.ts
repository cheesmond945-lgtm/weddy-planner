import { HttpException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { Paginated } from '../../common/utils/pagination';
import { categoryKindOf } from './category-kind';
import { unitOf } from '../../prisma/db-features';
import { officialWard } from '../weddings/wards';

/** Số khách và số bàn dự kiến để tính chi phí ước tính; khách chưa có đám cưới thì guestCount null, tables 0 (tính theo số bàn tối thiểu) */
export interface Expected {
  guestCount: number | null;
  tables: number;
}

export interface ServiceQuery {
  q?: string;
  category?: string;
  location?: string;
  /** Khu vực (phường/xã chính thức, có tiền tố, lấy từ GET /services/areas): lọc cứng, kết hợp AND với từ khóa */
  area?: string;
  /** Phong cách (thẻ gói): dịch vụ phải có đủ các phong cách này */
  styles?: string[];
  /** Số khách / số bàn dự kiến của người xem (cặp đôi đã thiết lập đám cưới) để tính chi phí ước tính nhà hàng */
  expected?: Expected;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Slug mà frontend dùng cho URL và icon: loại hạng mục nhận diện theo từ khóa (category-kind.ts), tên lạ thì slugify tên. */
export const categorySlug = (name: string | null) => (name ? (categoryKindOf(name) ?? slugify(name)) : '');

/**
 * Trung tâm tiệc cưới báo giá theo mâm (menu cho 10 khách), đã gồm sảnh và dịch vụ đi kèm;
 * đặt từ số mâm tối thiểu (service_packages.min_tables) mới được kèm sảnh. Các danh mục khác: giá trọn gói.
 */
export const TABLE_PRICED_SLUGS = ['nha-hang'];
export const GUESTS_PER_TABLE = 10;
export const priceUnitOf = (slug: string) => (TABLE_PRICED_SLUGS.includes(slug) ? ('TABLE' as const) : ('PACKAGE' as const));
/** Số mâm cần đặt: đủ chỗ cho số khách, không dưới số mâm tối thiểu của sảnh, ít nhất 1. */
export const tablesFor = (guests: number | null | undefined, minTables: number | null | undefined) =>
  Math.max(Math.ceil((guests ?? 0) / GUESTS_PER_TABLE), minTables ?? 0, 1);
/** Chi phí ước tính của một gói cho đám cưới: giá theo mâm thì nhân số mâm, giá trọn gói thì giữ nguyên. */
export const estimateCost = (slug: string, price: number, minTables: number | null | undefined, guests: number | null | undefined) =>
  priceUnitOf(slug) === 'TABLE' ? { total: price * tablesFor(guests, minTables), tables: tablesFor(guests, minTables) } : { total: price, tables: null };

/** Bỏ dấu tiếng Việt và viết thường để so khớp từ khóa: "Cầu Giấy" -> "cau giay". */
const foldText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Đổi từ "mâm" thành "bàn" (giữ kiểu viết hoa), chỉ khi đứng riêng một từ: "4.500.000đ/mâm" -> "4.500.000đ/bàn". */
const tablesNotTrays = (s: string) =>
  s.normalize('NFC').replace(/(?<!\p{L})m(â)m(?!\p{L})/giu, (w) => (w === w.toUpperCase() ? 'BÀN' : w[0] === 'M' ? 'Bàn' : 'bàn'));

/**
 * Cách hiện mục "Gói dịch vụ" ở trang chi tiết: "tiles" = mỗi gói một ô ảnh (biến thể của cùng dịch vụ:
 * chụp ảnh, váy cưới, trang điểm), "album" = card ảnh ghép theo album gói (mặc định).
 * CSDL chưa có cột service_categories.package_layout / lựa chọn riêng của NCC nên tạm cấu hình theo danh mục ở đây.
 */
const TILE_CATEGORIES = new Set(['chup-anh', 'trang-phuc', 'trang-diem']);
export const packageLayoutOf = (slug: string): 'tiles' | 'album' => (TILE_CATEGORIES.has(slug) ? 'tiles' : 'album');

/** Thứ tự hiển thị danh mục (như prototype): các slug lạ xếp cuối. */
export const CATEGORY_ORDER = ['nha-hang', 'decor', 'trang-phuc', 'makeup', 'chup-anh', 'hoa-cuoi'];
export const categoryRank = (slug: string) => {
  const i = CATEGORY_ORDER.indexOf(slug);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

/** Thời gian giữ danh sách NCC đang hiện trong bộ nhớ: NCC/Admin sửa gói thì khách thấy chậm tối đa chừng này. */
const VISIBLE_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS) > 0 ? Number(process.env.CATALOG_CACHE_TTL_MS) : 300_000;

/**
 * Frontend gọi "dịch vụ" = nhà cung cấp (vendor_profiles) đã duyệt có ít nhất một gói Approved.
 * "Gói" của dịch vụ = service_packages; mỗi gói là một album (package_albums).
 * Rating/reviewCount (điểm Google Maps) chưa có trong CSDL nên trả 0; FE hiện link googleMapsUrl để xem trên Google.
 */
@Injectable()
export class ServicesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  /**
   * NCC khách nhìn thấy: hồ sơ Approved, tài khoản Active, có gói Approved.
   * `alsoHidden`: id các NCC đang bị ẩn (Hidden) vẫn được trả về, dành cho cặp đôi đã có đơn với NCC đó (xem withOrderWith).
   */
  private async loadVisible(alsoHidden: string[] = []) {
    // DB ở xa (mỗi truy vấn ~100ms+, tải dữ liệu lớn có lúc mất vài giây): giữ kết quả VISIBLE_TTL_MS, các yêu cầu cùng lúc dùng chung một lần đọc.
    // Hết hạn thì trả ngay bản cũ và làm mới ngầm (stale-while-revalidate), người dùng không phải chờ lượt tải lại.
    const now = Date.now();
    if (!this.visibleCache) this.refreshVisible();
    else if (this.visibleCache.at + VISIBLE_TTL_MS < now && !this.refreshing) this.refreshVisible();
    const cache = this.visibleCache!;
    if (!alsoHidden.length) return cache.data;
    // NCC bị ẩn mà cặp đôi đã có đơn: đọc riêng (không cache), ghép vào theo đúng thứ tự created_date, id
    const [visible, hidden] = await Promise.all([cache.data, this.queryVisible({ status: 'Hidden', id: { in: alsoHidden } })]);
    const key = (v: (typeof visible)[number]) => `${v.created_date?.toISOString() ?? '~'}|${v.id}`;
    return [...visible, ...hidden].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  }

  private visibleCache: { at: number; data: ReturnType<ServicesService['queryVisible']> } | null = null;
  private refreshing = false;

  /** Đọc lại danh mục NCC. Lần đầu: yêu cầu chờ chính lượt đọc này. Các lần sau: bản cũ vẫn được phục vụ cho tới khi đọc xong, lỗi thì giữ bản cũ. */
  private refreshVisible() {
    // Lỗi mạng thoáng qua (kết nối bị ngắt, quá hạn): thử lại một lần trước khi báo lỗi
    const data = this.queryVisible({ status: 'Approved' }).catch(() => this.queryVisible({ status: 'Approved' }));
    this.refreshing = true;
    if (!this.visibleCache) this.visibleCache = { at: Date.now(), data };
    data.then(
      () => {
        this.visibleCache = { at: Date.now(), data };
        this.refreshing = false;
      },
      () => {
        this.refreshing = false;
        if (this.visibleCache?.data === data) this.visibleCache = null;
      },
    );
  }

  /** Nạp sẵn lúc khởi động để người đầu tiên mở trang Dịch vụ không phải chờ. */
  onModuleInit() {
    void this.loadVisible().catch(() => undefined);
  }

  private async queryVisible(status: { status: 'Approved' } | { status: 'Hidden'; id: { in: string[] } }) {
    return this.prisma.vendor_profiles.findMany({
      where: {
        users: { status: 'Active' },
        service_packages: { some: { status: 'Approved' } },
        ...status,
      },
      orderBy: [{ created_date: 'asc' }, { id: 'asc' }],
      relationLoadStrategy: 'join',
      include: {
        service_categories: { select: { id: true, name: true } },
        service_packages: {
          where: { status: 'Approved' },
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
          include: { package_albums: { orderBy: [{ is_cover: 'desc' }, { display_order: 'asc' }] }, package_tags: true },
        },
      },
    });
  }

  private img(path: string | null) {
    return this.storage.publicAlbumUrl(path);
  }

  /** Gói đã duyệt của một NCC (rẻ nhất trước) kèm ảnh bìa: dùng làm "thẻ gói" đầu hội thoại phía NCC. */
  async packageCards(vendorId: string) {
    const pkgs = await this.prisma.service_packages.findMany({
      where: { vendor_id: vendorId, status: 'Approved' },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      relationLoadStrategy: 'join',
      include: { package_albums: { orderBy: [{ is_cover: 'desc' }, { display_order: 'asc' }], take: 1 } },
    });
    return pkgs.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), imageUrl: p.package_albums[0] ? this.img(p.package_albums[0].url) : null }));
  }

  /**
   * Điểm trung bình (1 chữ số) và số lượt đánh giá của khách trên web (bảng reviews) cho nhiều NCC, một câu truy vấn.
   * NCC chưa có đánh giá thì không có trong Map.
   */
  private async webRatings(vendorIds: string[]) {
    const out = new Map<string, { rating: number; reviewCount: number }>();
    if (!vendorIds.length) return out;
    const rows = await this.prisma.reviews.findMany({
      where: { order_items: { orders: { vendor_id: { in: vendorIds } } } },
      select: { rating: true, order_items: { select: { orders: { select: { vendor_id: true } } } } },
    });
    const sums = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      const id = r.order_items.orders?.vendor_id;
      if (!id) continue;
      const cur = sums.get(id) ?? { sum: 0, count: 0 };
      sums.set(id, { sum: cur.sum + r.rating, count: cur.count + 1 });
    }
    for (const [id, x] of sums) out.set(id, { rating: Math.round((x.sum / x.count) * 10) / 10, reviewCount: x.count });
    return out;
  }

  private summarize(v: Awaited<ReturnType<ServicesService['loadVisible']>>[number], ratings?: Map<string, { rating: number; reviewCount: number }>) {
    const prices = v.service_packages.map((p) => Number(p.price));
    // Ảnh đại diện: ảnh bìa (is_cover) đầu tiên theo thứ tự gói; gói nào chưa đặt ảnh bìa thì bỏ qua. Không gói nào có thì lấy ảnh đầu tiên.
    const albums = v.service_packages.flatMap((p) => p.package_albums);
    const cover = albums.find((a) => a.is_cover) ?? albums[0];
    const slug = categorySlug(v.service_categories!.name);
    return {
      id: v.id,
      name: v.business_name,
      category: { id: v.service_categories!.id, slug, name: v.service_categories!.name ?? '' },
      location: v.city,
      address: [v.address, v.ward, v.city].filter(Boolean).join(', '),
      priceFrom: Math.min(...prices),
      priceTo: Math.max(...prices),
      /** TABLE: giá mỗi mâm 10 khách, đã gồm sảnh; PACKAGE: giá trọn gói */
      priceUnit: priceUnitOf(slug),
      /** Số mâm tối thiểu của gói rẻ nhất (gói xếp theo giá tăng dần) */
      minTables: v.service_packages[0]?.min_tables ?? null,
      /** Điểm trung bình đánh giá trên web (0 khi chưa có) và số lượt; thẻ dịch vụ hiện sao khi có đánh giá */
      rating: ratings?.get(v.id)?.rating ?? 0,
      reviewCount: ratings?.get(v.id)?.reviewCount ?? 0,
      coverImageUrl: cover ? this.img(cover.url) : '',
      googleMapsUrl: v.google_maps_url,
      /** NCC đang bị Admin ẩn (chỉ thấy được với cặp đôi đã có đơn): tạm ngừng nhận đơn mới */
      paused: v.status === 'Hidden',
    };
  }

  /** Dịch vụ dạng thẻ của các NCC đang hiển thị (NCC bị ẩn thì bỏ qua). */
  /**
   * Trong `ids`, các NCC đang bị ẩn nhưng cặp đôi `coupleUserId` đã có đơn (không tính nháp): vẫn phải thấy để theo dõi đơn đã tạo / đã cọc.
   */
  private async withOrderWith(coupleUserId: string, ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.orders.findMany({
      where: { vendor_id: { in: ids }, status: { not: 'Draft' }, weddings: { user_id: coupleUserId } },
      select: { vendor_id: true },
      distinct: ['vendor_id'],
    });
    return rows.flatMap((r) => (r.vendor_id ? [r.vendor_id] : []));
  }

  /** `forCouple`: thêm cả NCC đang bị ẩn mà cặp đôi này đã có đơn (kế hoạch, hội thoại của họ). */
  async summaries(ids: string[], forCouple?: string) {
    const wanted = new Set(ids);
    const hidden = forCouple ? await this.withOrderWith(forCouple, ids) : [];
    const vendors = (await this.loadVisible(hidden)).filter((v) => wanted.has(v.id));
    const ratings = await this.webRatings(vendors.map((v) => v.id));
    return vendors.map((v) => this.summarize(v, ratings));
  }

  async isVisible(id: string) {
    return (await this.loadVisible()).some((v) => v.id === id);
  }

  async categories() {
    const vendors = await this.loadVisible();
    const cats = await this.prisma.service_categories.findMany({ orderBy: { name: 'asc' } });
    return cats.sort((x, y) => categoryRank(categorySlug(x.name)) - categoryRank(categorySlug(y.name))).map((c) => {
      const mine = vendors.filter((v) => v.category_id === c.id);
      const cover = mine.flatMap((v) => v.service_packages.flatMap((p) => p.package_albums))[0];
      return {
        id: c.id,
        slug: categorySlug(c.name),
        name: c.name,
        imageUrl: cover ? this.img(cover.url) : '',
        serviceCount: mine.length,
      };
    });
  }

  /**
   * Chi phí thấp nhất của từng hạng mục cho số khách dự kiến (form thông tin đám cưới kiểm tra tổng ngân sách đủ tối thiểu):
   * min chi phí ước tính của các NCC đang hiển thị (cùng cách tính với tìm kiếm). Hạng mục chưa có NCC thì bỏ qua.
   */
  async minCosts(guests: number) {
    const vendors = await this.loadVisible();
    const expected: Expected = { guestCount: guests > 0 ? guests : null, tables: Math.max(1, Math.ceil(guests / GUESTS_PER_TABLE)) };
    const out = new Map<string, number>();
    for (const v of vendors) {
      const slug = categorySlug(v.service_categories?.name ?? null);
      const cost = this.estimatedCost(v, expected);
      if (slug && cost > 0 && cost < (out.get(slug) ?? Infinity)) out.set(slug, cost);
    }
    return [...out].map(([slug, minCost]) => ({ slug, minCost }));
  }

  /**
   * Chi phí ước tính của một NCC (dùng cho dropdown Mức giá và tìm kiếm, không bao giờ so đơn giá bàn):
   * dịch vụ thường = giá gói thấp nhất; nhà hàng = min theo gói (đủ chỗ nếu biết số khách) của đơn giá × max(số bàn dự kiến, số bàn tối thiểu, 1).
   */
  private estimatedCost(v: Awaited<ReturnType<ServicesService['loadVisible']>>[number], expected: Expected) {
    const tablePriced = priceUnitOf(categorySlug(v.service_categories?.name ?? null)) === 'TABLE';
    const pkgs = v.service_packages;
    const fit = expected.guestCount ? pkgs.filter((p) => p.capacity === null || p.capacity >= expected.guestCount!) : pkgs;
    const costs = (fit.length ? fit : pkgs).map((p) =>
      tablePriced || unitOf(p) === 'mâm' ? Number(p.price) * Math.max(expected.tables, p.min_tables ?? 0, 1) : Number(p.price),
    );
    return costs.length ? Math.min(...costs) : 0;
  }

  /** Số khách / số bàn dự kiến của cặp đôi (đám cưới đã thiết lập) và nơi tổ chức; chưa có thì null */
  async expectedFor(userId: string | null | undefined) {
    if (!userId) return null;
    const w = await this.prisma.weddings.findUnique({ where: { user_id: userId }, select: { guest_count: true, table_count_override: true, ward: true } }).catch(() => null);
    if (!w) return null;
    const guests = w.guest_count ?? 0;
    return { guestCount: guests || null, tables: w.table_count_override ?? Math.max(1, Math.ceil(guests / 10)), ward: (w as { ward?: string | null }).ward ?? null };
  }

  /**
   * Dữ liệu cho tìm kiếm (search.service.ts): thẻ dịch vụ kèm mô tả, khu vực chính thức, phong cách, chi phí ước tính.
   * Chỉ NCC đã duyệt, đang hiển thị (loadVisible).
   */
  async catalogItems(expected: Expected) {
    const vendors = await this.loadVisible();
    const ratings = await this.webRatings(vendors.map((v) => v.id));
    return vendors.map((v) => {
      const s = this.summarize(v, ratings);
      return {
        ...s,
        name: s.name ?? '',
        description: v.description ?? '',
        categoryName: s.category.name,
        area: officialWard(v.ward),
        styles: [...new Set(v.service_packages.flatMap((p) => p.package_tags.map((t) => t.tag)))],
        rating: s.rating,
        reviewCount: s.reviewCount,
        /** Chi phí ước tính theo số bàn dự kiến của người xem */
        cost: this.estimatedCost(v, expected),
      };
    });
  }

  /**
   * Khu vực để lọc: các phường/xã khác nhau trong dữ liệu NCC đang hiển thị, đổi về tên chính thức có tiền tố
   * ("Phường Đống Đa"), xếp theo tên. Dùng chung cho bộ lọc trang Dịch vụ và ô nơi tổ chức trong form đám cưới.
   */
  async areas() {
    const vendors = await this.loadVisible();
    const names = [...new Set(vendors.map((v) => officialWard(v.ward)).filter((w): w is string => !!w))];
    return names.sort((a, b) => a.replace(/^(Phường|Xã) /, '').localeCompare(b.replace(/^(Phường|Xã) /, ''), 'vi'));
  }

  async locations() {
    const vendors = await this.prisma.vendor_profiles.findMany({
      where: { status: 'Approved', users: { status: 'Active' }, service_packages: { some: { status: 'Approved' } } },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    return vendors.map((v) => v.city);
  }

  async styles() {
    const tags = await this.prisma.package_tags.groupBy({
      by: ['tag'],
      where: { service_packages: { status: 'Approved' } },
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: 12,
    });
    return tags.map((t) => t.tag);
  }

  async list(query: ServiceQuery) {
    const page = Math.max(1, Math.trunc(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 20) || 20));
    // Tìm kiếm tầng 1: từ khóa chỉ khớp chữ trong tên và mô tả của NCC (không khớp khu vực, địa chỉ hay danh mục), không phân biệt dấu và hoa thường.
    // Khu vực là bộ lọc cứng riêng (area), kết hợp AND với từ khóa.
    const q = foldText(query.q?.trim() ?? '');

    const vendors = (await this.loadVisible()).filter((v) => (!query.area || officialWard(v.ward) === query.area) && (!q || foldText(`${v.business_name ?? ''} ${v.description ?? ''}`).includes(q)));
    const ratings = await this.webRatings(vendors.map((v) => v.id));
    // Mức giá so với CHI PHÍ ƯỚC TÍNH (nhà hàng: đơn giá × max(số bàn dự kiến, tối thiểu)), không so đơn giá bàn
    const expected = query.expected ?? { guestCount: null, tables: 0 };
    const wantStyles = (query.styles ?? []).map((x) => foldText(x));
    const items = vendors
      .filter((v) => {
        if (!wantStyles.length) return true;
        const tags = new Set(v.service_packages.flatMap((p) => p.package_tags.map((t) => foldText(t.tag))));
        return wantStyles.every((x) => tags.has(x));
      })
      .map((v) => ({ s: this.summarize(v, ratings), cost: this.estimatedCost(v, expected) }))
      .filter(
        ({ s, cost }) =>
          (!query.category || s.category.slug === query.category) &&
          (!query.location || s.location === query.location) &&
          (query.priceMin === undefined || cost >= query.priceMin) &&
          (query.priceMax === undefined || cost < query.priceMax),
      )
      .map(({ s, cost }) => ({ ...s, estimatedCost: cost }));

    const rows = items.slice((page - 1) * pageSize, page * pageSize);
    return Paginated.of(rows, items.length, { page, pageSize });
  }

  /** `includeHidden`: chỉ truyền true khi người gọi đã kiểm tra cặp đôi có đơn với NCC này (OrdersService.serviceOf). */
  async detail(id: string, includeHidden = false) {
    const v = (await this.loadVisible(includeHidden ? [id] : [])).find((x) => x.id === id);
    if (!v) throw new HttpException({ code: 'SERVICE_NOT_FOUND', message: 'Không tìm thấy dịch vụ.' }, 404);

    const prices = v.service_packages.map((p) => Number(p.price));
    const capacities = v.service_packages.map((p) => p.capacity).filter((c): c is number => c !== null);
    const covers = v.service_packages.flatMap((p) => p.package_albums.filter((a) => a.is_cover));
    const others = v.service_packages.flatMap((p) => p.package_albums.filter((a) => !a.is_cover));
    // Ảnh đại diện nằm ở gói khác gói đầu (vd ForeverMark lấy ảnh sảnh Xanh Đêm): đưa cả album gói đó lên đầu thư viện ảnh,
    // thứ tự gói giữ nguyên. Ảnh đại diện ở gói đầu thì giữ cách xếp cũ (ảnh bìa các gói trước, rồi các ảnh còn lại).
    const coverPkg = v.service_packages.find((p) => p.package_albums.some((a) => a.is_cover));
    const gallery =
      coverPkg && coverPkg !== v.service_packages[0]
        ? [...coverPkg.package_albums, ...v.service_packages.filter((p) => p !== coverPkg).flatMap((p) => p.package_albums)]
        : [...covers, ...others];
    const tags = [...new Set(v.service_packages.flatMap((p) => p.package_tags.map((t) => t.tag)))];
    const tablePriced = priceUnitOf(categorySlug(v.service_categories?.name ?? null)) === 'TABLE';
    const isTable = (p: { unit?: string | null; description?: string | null }) => tablePriced || unitOf(p) === 'mâm';

    return {
      ...this.summarize(v, await this.webRatings([v.id])),
      priceTo: Math.max(...prices),
      description: v.description,
      highlights: [] as string[],
      capacity: capacities.length ? Math.max(...capacities) : null,
      styles: tags,
      workingHours: v.working_hours ?? '',
      packageLayout: packageLayoutOf(categorySlug(v.service_categories?.name ?? null)),
      // Số điện thoại NCC: dùng khi FE chọn nhắn qua Zalo (VITE_CHAT_MODE=zalo)
      contactPhone: (await this.prisma.users.findUnique({ where: { id: v.user_id ?? undefined }, select: { phone_number: true } }))?.phone_number ?? null,
      isVerified: true,
      isGuaranteed: false,
      images: gallery.slice(0, 60).map((a) => this.img(a.url)),
      packages: v.service_packages.map((p) => ({
        id: p.id,
        name: p.name,
        // Nhà hàng tính theo bàn: mô tả NCC còn ghi "mâm" thì đổi sang "bàn" cho thống nhất
        description: tablesNotTrays(p.description ?? ''),
        price: Number(p.price),
        capacity: p.capacity,
        // Đơn vị tính (cột service_packages.unit, hoặc danh mục báo giá theo mâm): "mâm" là giá một mâm, giao diện gọi là "bàn"; còn lại là trọn gói
        unit: isTable(p) ? 'bàn' : 'gói',
        pricingUnit: isTable(p) ? ('TABLE' as const) : ('PACKAGE' as const),
        // Ảnh bìa và thẻ (tag) của gói: chỉ dùng cho tìm kiếm và bộ lọc, không so với đám cưới
        imageUrl: p.package_albums[0] ? this.img(p.package_albums[0].url) : null,
        tags: p.package_tags.map((t) => t.tag),
        minTables: p.min_tables,
      })),
      albums: v.service_packages.map((p) => ({
        id: p.id,
        title: p.name,
        imageCount: p.package_albums.length,
        previewImageUrls: p.package_albums.slice(0, 3).map((a) => this.img(a.url)),
        imageUrls: p.package_albums.map((a) => this.img(a.url)),
      })),
    };
  }
}
