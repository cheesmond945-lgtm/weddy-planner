import { HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ALBUM_BUCKET, DOC_BUCKET, StorageService } from '../../integrations/storage/storage.service';
import { categorySlug } from '../catalog/services.service';
import { EXT_BY_MIME, IMAGE_MIMES, decodeFileName, fileNameOfPath, mimeOfPath, safeBaseName } from './vendor-files';
import { BusinessHours, formatHours, parseHours, validateHours } from './working-hours';

export type VendorFileDto = { url: string; publicId: string; fileName: string; size: number; mimeType: string };
type DocType = 'BUSINESS_LICENSE' | 'FIRE_SAFETY' | 'FOOD_SAFETY';
type FileWithType<T> = VendorFileDto & { type: T };

export interface UpdateProfileBody {
  businessName?: string | null;
  taxCode?: string | null;
  representativeName?: string | null;
  district?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  businessHours?: BusinessHours | null;
  documents?: FileWithType<DocType>[];
  photos?: FileWithType<'FRONT'>[];
}

const STATUS_OUT: Record<string, string> = { Draft: 'NOT_SUBMITTED', Pending: 'PENDING', NeedRevision: 'NEEDS_REVISION', Approved: 'VERIFIED' };
const DOC_TO_DB: Record<DocType, string> = { BUSINESS_LICENSE: 'BusinessLicense', FIRE_SAFETY: 'FireSafety', FOOD_SAFETY: 'FoodSafety' };
const DB_TO_DOC = Object.fromEntries(Object.entries(DOC_TO_DB).map(([k, v]) => [v, k])) as Record<string, DocType>;
const PHOTO_DB = 'StorefrontPhoto';
const MANAGED_DB_TYPES = [...Object.values(DOC_TO_DB), PHOTO_DB];
const MAPS_RE = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|(www\.)?google\.com\/maps)/i;
const TAX_RE = /^\d{10}(-\d{3})?$/;
const SIGNED_URL_SECONDS = 3600;

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

export type UploadPurpose = 'VENDOR_DOCUMENT' | 'VENDOR_PHOTO' | 'PACKAGE_PHOTO';

@Injectable()
export class VendorProfileService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  /** Hồ sơ NCC của tài khoản đang đăng nhập. */
  async findVendor(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({
      where: { user_id: userId },
      include: {
        service_categories: { select: { id: true, name: true } },
        vendor_documents: { orderBy: [{ display_order: 'asc' }, { created_date: 'asc' }] },
        vendor_verifications: { orderBy: { submitted_date: 'desc' }, take: 1 },
      },
    });
    if (!v) return fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
    return v;
  }

  async vendorId(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!v) return fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
    return v.id;
  }

  private async toFile(path: string): Promise<VendorFileDto> {
    const url = (await this.storage.signedDocumentUrl(path, SIGNED_URL_SECONDS)) ?? '';
    // CSDL không lưu kích thước nên hỏi Storage (HEAD vào link ký); lỗi thì để 0
    const size = url ? await fetch(url, { method: 'HEAD' }).then((r) => Number(r.headers.get('content-length')) || 0).catch(() => 0) : 0;
    return { url, publicId: path, fileName: fileNameOfPath(path), size, mimeType: mimeOfPath(path) };
  }

  private async toProfile(v: Awaited<ReturnType<VendorProfileService['findVendor']>>) {
    const docs = v.vendor_documents.filter((d) => d.document_type in DB_TO_DOC);
    const photos = v.vendor_documents.filter((d) => d.document_type === PHOTO_DB);
    const verified = v.status === 'Approved';
    const cat = { id: v.service_categories.id, slug: categorySlug(v.service_categories.name), name: v.service_categories.name };
    const lastReview = v.vendor_verifications[0];

    return {
      id: v.id,
      status: STATUS_OUT[v.status] ?? 'NOT_SUBMITTED',
      businessName: v.business_name || null,
      taxCode: v.tax_code,
      representativeName: v.representative_name || null,
      category: cat,
      verifiedCategory: verified ? cat : null,
      province: v.city || 'Hà Nội',
      district: v.ward || null,
      address: v.address || null,
      googleMapsUrl: v.google_maps_url,
      businessHours: parseHours(v.working_hours),
      documents: await Promise.all(docs.map(async (d) => ({ type: DB_TO_DOC[d.document_type], ...(await this.toFile(d.url)) }))),
      photos: await Promise.all(photos.map(async (d) => ({ type: 'FRONT' as const, ...(await this.toFile(d.url)) }))),
      reviewNote: v.status === 'NeedRevision' ? (lastReview?.admin_note ?? null) : null,
      submittedAt: lastReview?.submitted_date.toISOString() ?? null,
      updatedAt: v.updated_date.toISOString(),
    };
  }

  async getProfile(userId: string) {
    return this.toProfile(await this.findVendor(userId));
  }

  async save(userId: string, body: UpdateProfileBody, submit: boolean) {
    const v = await this.findVendor(userId);
    if (v.status === 'Pending' || v.status === 'Approved') {
      return fail('VENDOR_PROFILE_LOCKED', 'Hồ sơ đang chờ duyệt hoặc đã xác minh, không thể chỉnh sửa.', 409);
    }

    const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null);
    const businessName = str(body.businessName);
    const taxCode = str(body.taxCode);
    const representativeName = str(body.representativeName);
    const district = str(body.district);
    const address = str(body.address);
    const googleMapsUrl = str(body.googleMapsUrl);
    const hours = body.businessHours ?? null;
    const documents = body.documents ?? [];
    const photos = body.photos ?? [];
    const slug = categorySlug(v.service_categories.name);
    const isRestaurant = slug === 'nha-hang';

    const errors: Record<string, string> = {};
    if (businessName && businessName.length > 200) errors.businessName = 'Tối đa 200 ký tự.';
    if (representativeName && representativeName.length > 100) errors.representativeName = 'Tối đa 100 ký tự.';
    if (district && district.length > 100) errors.district = 'Tối đa 100 ký tự.';
    if (address && address.length > 255) errors.address = 'Tối đa 255 ký tự.';
    if (taxCode && !TAX_RE.test(taxCode)) errors.taxCode = 'Mã số thuế gồm 10 chữ số (hoặc 10 số + 3 số chi nhánh).';
    if (googleMapsUrl && (googleMapsUrl.length > 500 || !MAPS_RE.test(googleMapsUrl))) errors.googleMapsUrl = 'Chưa phải link Google Maps.';
    if (hours) {
      const problem = validateHours(hours);
      if (problem) errors.businessHours = problem;
    }

    // Tệp: chỉ nhận tệp của chính NCC này (đã upload qua API hoặc đã có trong hồ sơ)
    const owned = new Set(v.vendor_documents.map((d) => d.url));
    const mine = (path: string) => typeof path === 'string' && (path.startsWith(`vendors/${v.id}/`) || owned.has(path));
    const allowedTypes: DocType[] = isRestaurant ? ['BUSINESS_LICENSE', 'FIRE_SAFETY', 'FOOD_SAFETY'] : ['BUSINESS_LICENSE', 'FIRE_SAFETY'];
    const seen = new Set<string>();
    for (const d of documents) {
      if (!allowedTypes.includes(d.type)) errors.documents = `Loại giấy tờ ${d.type} không thuộc bộ của lĩnh vực này.`;
      else if (seen.has(d.type)) errors.documents = 'Mỗi loại giấy tờ chỉ một tệp.';
      else if (!mine(d.publicId)) errors.documents = 'Tệp không hợp lệ, hãy tải lên lại.';
      seen.add(d.type);
    }
    for (const p of photos) if (!mine(p.publicId)) errors.photos = 'Tệp không hợp lệ, hãy tải lên lại.';

    if (submit) {
      if (!businessName) errors.businessName = 'Vui lòng nhập tên doanh nghiệp.';
      if (!taxCode) errors.taxCode = 'Vui lòng nhập mã số thuế.';
      if (!representativeName) errors.representativeName = 'Vui lòng nhập người đại diện.';
      if (!district) errors.district = 'Vui lòng chọn quận/huyện.';
      if (!address) errors.address = 'Vui lòng nhập địa chỉ.';
      for (const t of allowedTypes) if (!seen.has(t)) errors.documents ??= 'Cần tải đủ giấy tờ bắt buộc.';
      if (isRestaurant && photos.length === 0) errors.photos = 'Nhà hàng cần ít nhất 1 ảnh mặt tiền.';
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin hồ sơ chưa hợp lệ.', 400, errors);

    const keep = new Set([...documents, ...photos].map((f) => f.publicId));
    const dropped = v.vendor_documents
      .filter((d) => MANAGED_DB_TYPES.includes(d.document_type) && !keep.has(d.url) && d.url.startsWith(`vendors/${v.id}/`))
      .map((d) => d.url);

    try {
      await this.prisma.$transaction([
        this.prisma.vendor_profiles.update({
          where: { id: v.id },
          data: {
            business_name: businessName ?? '',
            tax_code: taxCode,
            representative_name: representativeName ?? '',
            ward: district ?? '',
            address: address ?? '',
            google_maps_url: googleMapsUrl,
            working_hours: hours ? formatHours(hours) : null,
            ...(submit && { status: 'Pending' }),
          },
        }),
        this.prisma.vendor_documents.deleteMany({ where: { vendor_id: v.id, document_type: { in: MANAGED_DB_TYPES } } }),
        this.prisma.vendor_documents.createMany({
          data: [
            ...documents.map((d, i) => ({ vendor_id: v.id, document_type: DOC_TO_DB[d.type], url: d.publicId, display_order: i })),
            ...photos.map((p, i) => ({ vendor_id: v.id, document_type: PHOTO_DB, url: p.publicId, display_order: i })),
          ],
        }),
        ...(submit ? [this.prisma.vendor_verifications.create({ data: { vendor_id: v.id, status: 'Pending' } })] : []),
      ]);
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        return fail('VALIDATION_ERROR', 'Mã số thuế đã được dùng bởi nhà cung cấp khác.', 400, { taxCode: 'Mã số thuế đã tồn tại.' });
      }
      throw e;
    }

    await this.storage.remove(DOC_BUCKET, dropped);
    return this.getProfile(userId);
  }

  /** Upload một tệp lên Supabase Storage; trả về VendorFile để FE đưa vào hồ sơ hoặc gói. */
  async upload(userId: string, purpose: string, file: Express.Multer.File | undefined) {
    if (!file) return fail('VALIDATION_ERROR', 'Chưa chọn tệp.', 400);
    if (!['VENDOR_DOCUMENT', 'VENDOR_PHOTO', 'PACKAGE_PHOTO'].includes(purpose)) {
      return fail('VALIDATION_ERROR', 'Mục đích upload không được hỗ trợ.', 400);
    }
    const p = purpose as UploadPurpose;
    const allowed = p === 'VENDOR_DOCUMENT' ? [...IMAGE_MIMES, 'application/pdf'] : IMAGE_MIMES;
    const maxBytes = p === 'PACKAGE_PHOTO' ? 5 * 1048576 : 10 * 1048576; // bucket package-albums giới hạn 5MB
    if (!allowed.includes(file.mimetype)) {
      return fail('VALIDATION_ERROR', p === 'VENDOR_DOCUMENT' ? 'Chỉ nhận PDF, JPG, PNG, WEBP.' : 'Chỉ nhận JPG, PNG, WEBP.', 400);
    }
    if (file.size > maxBytes) return fail('VALIDATION_ERROR', `Tệp vượt ${maxBytes / 1048576}MB.`, 400);

    const vendorId = await this.vendorId(userId);
    const originalName = decodeFileName(file.originalname);
    const folder = p === 'VENDOR_DOCUMENT' ? 'documents' : p === 'VENDOR_PHOTO' ? 'photos' : 'packages';
    const path = `vendors/${vendorId}/${folder}/${randomUUID()}_${safeBaseName(originalName)}.${EXT_BY_MIME[file.mimetype]}`;
    const bucket = p === 'PACKAGE_PHOTO' ? ALBUM_BUCKET : DOC_BUCKET;

    try {
      await this.storage.upload(bucket, path, file.buffer, file.mimetype);
    } catch (e) {
      return fail('UPLOAD_FAILED', `Tải tệp lên không thành công: ${(e as Error).message}`, 502);
    }
    const url = bucket === ALBUM_BUCKET ? this.storage.publicAlbumUrl(path) : ((await this.storage.signedDocumentUrl(path, SIGNED_URL_SECONDS)) ?? '');
    return { url, publicId: path, fileName: originalName, size: file.size, mimeType: file.mimetype };
  }
}
