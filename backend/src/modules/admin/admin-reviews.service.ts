import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ALBUM_BUCKET, StorageService } from '../../integrations/storage/storage.service';
import { notify } from '../chat/chat-messages';
import { categorySlug } from '../catalog/services.service';
import { fileNameOfPath, mimeOfPath } from '../vendors/vendor-files';
import { livePhotos, liveSnapshot, openUpdate } from '../vendors/package-update';
import { parseHours } from '../vendors/working-hours';
import { fail, matches, UUID } from './admin-common';

const VENDOR_STATUS_OUT: Record<string, string> = { Draft: 'NOT_SUBMITTED', Pending: 'PENDING', NeedRevision: 'NEEDS_REVISION', Approved: 'VERIFIED' };
const PACKAGE_STATUS_OUT: Record<string, string> = { Pending: 'PENDING', NeedRevision: 'NEEDS_REVISION', Approved: 'PUBLISHED', Hidden: 'HIDDEN' };
const DOC_OUT: Record<string, string> = { BusinessLicense: 'BUSINESS_LICENSE', FireSafety: 'FIRE_SAFETY', FoodSafety: 'FOOD_SAFETY', SkillCertificate: 'SKILL_CERTIFICATE' };
const MAX_NOTE = 1000;

export interface ReviewQueryDto {
  q?: string;
  status?: string;
  categorySlug?: string;
}

export interface VendorQueryDto extends ReviewQueryDto {
  /** 'recent' (mặc định): nộp gần đây nhất trước; 'oldest': nộp trước nhất, để duyệt theo thứ tự nộp */
  sort?: string;
  /** Chỉ lấy hồ sơ nộp trong N ngày gần đây (1, 3, 7, 30, 90) */
  days?: string | number;
  page?: string | number;
  pageSize?: string | number;
}

const catRef = (c: { id: string; name: string | null } | null) => ({ id: c?.id ?? '', slug: categorySlug(c?.name ?? null), name: c?.name ?? '' });

/** Duyệt hồ sơ nhà cung cấp (vendor_profiles + vendor_verifications) và gói dịch vụ (service_packages + package_verifications). */
@Injectable()
export class AdminReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  private checkNote(note: string | undefined) {
    const text = note?.trim() ?? '';
    if (!text) return fail('VALIDATION_ERROR', 'Nhập nội dung yêu cầu.', 400, { note: 'Nhập nội dung yêu cầu.' });
    if (text.length > MAX_NOTE) return fail('VALIDATION_ERROR', `Nội dung tối đa ${MAX_NOTE} ký tự.`, 400);
    return text;
  }

  // ================= Hồ sơ nhà cung cấp =================

  private vendorInclude = {
    service_categories: true,
    users: { select: { full_name: true, email: true, phone_number: true } },
    vendor_verifications: { orderBy: { submitted_date: 'desc' as const }, take: 1 },
  };

  private vendorDto(v: Awaited<ReturnType<AdminReviewsService['loadVendors']>>[number]) {
    const last = v.vendor_verifications[0];
    // Hồ sơ đã duyệt có một lần cập nhật chưa kiểm (hậu kiểm) cũng nằm trong danh sách chờ duyệt
    const updateReview = v.status === 'Approved' && last?.status === 'Pending';
    // Đã duyệt nhưng bản cập nhật gần nhất bị yêu cầu chỉnh sửa: hồ sơ vẫn hiển thị, NCC đang sửa
    const updateRevision = v.status === 'Approved' && last?.status === 'NeedRevision';
    return {
      id: v.id,
      businessName: v.business_name,
      taxCode: v.tax_code,
      representativeName: v.representative_name || null,
      category: catRef(v.service_categories),
      province: v.city || 'Hà Nội',
      ward: v.ward || null,
      address: v.address || null,
      googleMapsUrl: v.google_maps_url,
      openTime: parseHours(v.working_hours)?.openTime ?? null,
      closeTime: parseHours(v.working_hours)?.closeTime ?? null,
      description: v.description || null,
      documents: [] as unknown[],
      photos: [] as unknown[],
      status: updateReview ? 'PENDING' : updateRevision ? 'NEEDS_REVISION' : (VENDOR_STATUS_OUT[v.status ?? ''] ?? 'NOT_SUBMITTED'),
      /** Duyệt lần đầu (hồ sơ Pending) hoặc kiểm tra cập nhật (hồ sơ Approved có lần gửi cập nhật chưa kiểm). */
      reviewKind: updateReview ? 'UPDATE' : v.status === 'Pending' ? 'INITIAL' : null,
      reviewNote: v.status === 'NeedRevision' || updateRevision ? (last?.admin_note ?? null) : null,
      submittedAt: (last?.submitted_date ?? v.updated_date)?.toISOString() ?? '',
      owner: { name: v.users?.full_name ?? null, email: v.users?.email ?? null, phone: v.users?.phone_number ?? null },
    };
  }

  private loadVendors(where: object = {}) {
    return this.prisma.vendor_profiles.findMany({ where: { status: { not: 'Draft' }, ...where }, include: this.vendorInclude });
  }

  /**
   * Danh sách nhẹ (chưa kèm tệp: giấy tờ là link ký riêng tư, tải khi mở chi tiết), có phân trang.
   * `counts` là số hồ sơ theo từng trạng thái trong phạm vi tìm kiếm và lĩnh vực hiện tại (không tính bộ lọc trạng thái), để hiện số trên các nhãn.
   */
  async listVendors(q: VendorQueryDto) {
    const inScope = (await this.loadVendors())
      .map((v) => this.vendorDto(v))
      .filter((v) => matches(q.q, v.businessName, v.representativeName, v.taxCode, v.owner.email, v.province, v.ward) && (!q.categorySlug || v.category.slug === q.categorySlug));
    const days = Math.trunc(Number(q.days)) || 0;
    const since = days > 0 ? Date.now() - days * 86_400_000 : 0;
    const scoped = inScope.filter((v) => !since || new Date(v.submittedAt).getTime() >= since);
    const counts = { ALL: scoped.length, PENDING: 0, NEEDS_REVISION: 0, VERIFIED: 0 };
    for (const v of scoped) if (v.status in counts) counts[v.status as 'PENDING' | 'NEEDS_REVISION' | 'VERIFIED']++;

    const dir = q.sort === 'oldest' ? 1 : -1;
    const rows = scoped.filter((v) => !q.status || v.status === q.status).sort((a, b) => dir * a.submittedAt.localeCompare(b.submittedAt) || (a.businessName ?? '').localeCompare(b.businessName ?? '', 'vi'));
    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const size = Math.min(100, Math.max(1, Math.trunc(Number(q.pageSize)) || 10));
    return { items: rows.slice((page - 1) * size, page * size), total: rows.length, counts };
  }

  async getVendor(id: string) {
    const v = UUID.test(id) ? (await this.loadVendors({ id }))[0] : undefined;
    if (!v) return fail('VENDOR_NOT_FOUND', 'Không tìm thấy hồ sơ nhà cung cấp.', 404);
    const docs = await this.prisma.vendor_documents.findMany({ where: { vendor_id: id, document_type: { in: [...Object.keys(DOC_OUT), 'StorefrontPhoto'] } }, orderBy: [{ display_order: 'asc' }, { created_date: 'asc' }] });
    const file = async (path: string | null) => {
      const url = (await this.storage.signedDocumentUrl(path, 3600)) ?? '';
      const size = url ? await fetch(url, { method: 'HEAD' }).then((r) => Number(r.headers.get('content-length')) || 0).catch(() => 0) : 0;
      return { url, publicId: path, fileName: fileNameOfPath(path), size, mimeType: mimeOfPath(path) };
    };
    const dto = this.vendorDto(v);
    // Chỉ khi lần nộp ngay trước lần đang chờ là một lần bị yêu cầu chỉnh sửa (NCC vừa sửa và gửi lại): cho Admin xem lý do để đối chiếu.
    // Nếu lần trước đã được duyệt thì không có gì để đối chiếu. vendor_verifications giữ mọi lần nộp.
    let prev: { admin_note: string | null; reviewed_date: Date | null } | null = null;
    if (dto.status === 'PENDING') {
      const [, before] = await this.prisma.vendor_verifications.findMany({ where: { vendor_id: id }, orderBy: { submitted_date: 'desc' }, take: 2 });
      if (before?.status === 'NeedRevision') prev = before;
    }
    return {
      ...dto,
      lastRevision: prev ? { note: prev.admin_note, reviewedAt: prev.reviewed_date?.toISOString() ?? null } : null,
      documents: await Promise.all(docs.filter((d) => !!d.document_type && d.document_type in DOC_OUT).map(async (d) => ({ type: DOC_OUT[d.document_type!], ...(await file(d.url)) }))),
      photos: await Promise.all(docs.filter((d) => d.document_type === 'StorefrontPhoto').map(async (d) => ({ type: 'FRONT', ...(await file(d.url)) }))),
    };
  }

  /** Duyệt (note = undefined) hoặc yêu cầu bổ sung (note bắt buộc) một hồ sơ đang chờ. */
  async reviewVendor(id: string, note?: string) {
    const v = UUID.test(id) ? (await this.loadVendors({ id }))[0] : undefined;
    if (!v) return fail('VENDOR_NOT_FOUND', 'Không tìm thấy hồ sơ nhà cung cấp.', 404);
    const updateReview = v.status === 'Approved' && v.vendor_verifications[0]?.status === 'Pending';
    if (v.status !== 'Pending' && !updateReview) return fail('VENDOR_PROFILE_NOT_PENDING', 'Chỉ xử lý được hồ sơ đang chờ duyệt.', 409);
    const revision = note !== undefined;
    const text = revision ? this.checkNote(note) : null;

    const pending = await this.prisma.vendor_verifications.findFirst({ where: { vendor_id: id, status: 'Pending' }, orderBy: { submitted_date: 'desc' } });
    const result = revision ? { status: 'NeedRevision', admin_note: text, reviewed_date: new Date() } : { status: 'Approved', admin_note: null, reviewed_date: new Date() };
    await this.prisma.$transaction([
      // Hồ sơ chờ duyệt lần đầu: duyệt -> Approved, yêu cầu sửa -> NeedRevision (chưa hiển thị).
      // Bản cập nhật của hồ sơ đã duyệt: hồ sơ luôn giữ Approved (vẫn hiển thị); kết quả chỉ ghi ở dòng xác minh (Approved / NeedRevision kèm lý do).
      this.prisma.vendor_profiles.update({ where: { id }, data: { status: updateReview ? 'Approved' : revision ? 'NeedRevision' : 'Approved', updated_date: new Date() } }),
      pending
        ? this.prisma.vendor_verifications.update({ where: { id: pending.id }, data: result })
        : this.prisma.vendor_verifications.create({ data: { vendor_id: id, ...result } }),
    ]);
    await notify(this.prisma, {
      userId: v.user_id!,
      type: revision ? 'VendorNeedRevision' : 'VendorApproved',
      title: revision ? 'Hồ sơ cần bổ sung' : 'Hồ sơ đã được xác minh',
      content: revision ? `Quản trị viên yêu cầu bổ sung hồ sơ: ${text}` : 'Hồ sơ nhà cung cấp của bạn đã được xác minh. Bạn có thể gửi duyệt gói dịch vụ.',
      referenceType: 'VendorProfile',
      referenceId: id,
    });
    return this.getVendor(id);
  }

  // ================= Gói dịch vụ =================

  private packageInclude = {
    vendor_profiles: { select: { id: true, user_id: true, business_name: true, city: true, service_categories: true } },
    package_albums: { orderBy: [{ display_order: 'asc' as const }, { id: 'asc' as const }] },
    package_tags: true,
    package_verifications: { orderBy: { created_date: 'desc' as const }, take: 1 },
  };

  private loadPackages(where: object = {}) {
    return this.prisma.service_packages.findMany({ where: { status: { not: 'Draft' }, ...where }, include: this.packageInclude });
  }

  /** Bản cập nhật Admin nhìn thấy: đã gửi (chờ duyệt hoặc đã bị yêu cầu chỉnh sửa); bản nháp của NCC thì chưa. */
  private sentUpdate(p: Awaited<ReturnType<AdminReviewsService['loadPackages']>>[number]) {
    const upd = openUpdate(p);
    return upd && upd.status !== 'Draft' ? upd : null;
  }

  private packageDto(p: Awaited<ReturnType<AdminReviewsService['loadPackages']>>[number]) {
    const last = p.package_verifications[0];
    const live = liveSnapshot(p);
    const upd = this.sentUpdate(p);
    // Gói đã đăng có bản cập nhật đã gửi: hiện nội dung bản cập nhật, trạng thái theo bản cập nhật (cùng cách với hồ sơ NCC)
    const shown = upd?.data ?? live;
    return {
      id: p.id,
      name: shown.name,
      description: shown.description,
      price: shown.price,
      capacity: shown.capacity,
      tags: shown.tags,
      photos: shown.photos.map((u) => this.storage.publicAlbumUrl(u)),
      category: catRef(p.vendor_profiles!.service_categories),
      vendor: { id: p.vendor_profiles!.id, name: p.vendor_profiles!.business_name, city: p.vendor_profiles!.city },
      status: upd ? (upd.status === 'Pending' ? 'PENDING' : 'NEEDS_REVISION') : (PACKAGE_STATUS_OUT[p.status ?? ''] ?? 'PENDING'),
      /** Duyệt lần đầu (gói chưa đăng) hoặc duyệt bản cập nhật của gói đã đăng */
      reviewKind: upd?.status === 'Pending' ? 'UPDATE' : p.status === 'Pending' ? 'INITIAL' : null,
      reviewNote: p.status === 'NeedRevision' ? (last?.admin_note ?? null) : upd?.status === 'NeedRevision' ? upd.admin_note : null,
      /** Bản đang hiển thị với khách, để đối chiếu với bản cập nhật */
      published: upd ? { ...live, photos: live.photos.map((u) => this.storage.publicAlbumUrl(u)) } : null,
      submittedAt: (upd?.created_date ?? (last && last.status !== 'Draft' ? last.created_date : p.updated_date))?.toISOString() ?? '',
    };
  }

  /**
   * Danh sách gói có phân trang. `counts` là số gói theo từng trạng thái trong phạm vi tìm kiếm, lĩnh vực và thời gian nộp hiện tại
   * (không tính bộ lọc trạng thái), để hiện số trên các nhãn trạng thái.
   */
  async listPackages(q: VendorQueryDto) {
    const days = Math.trunc(Number(q.days)) || 0;
    const since = days > 0 ? Date.now() - days * 86_400_000 : 0;
    const scoped = (await this.loadPackages())
      .map((p) => this.packageDto(p))
      .filter((p) => matches(q.q, p.name, p.vendor.name) && (!q.categorySlug || p.category.slug === q.categorySlug) && (!since || new Date(p.submittedAt).getTime() >= since));
    const counts = { ALL: scoped.length, PENDING: 0, NEEDS_REVISION: 0, PUBLISHED: 0, HIDDEN: 0 };
    for (const p of scoped) if (p.status in counts) counts[p.status as 'PENDING' | 'NEEDS_REVISION' | 'PUBLISHED' | 'HIDDEN']++;

    const rows = scoped.filter((p) => !q.status || p.status === q.status).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.name.localeCompare(b.name, 'vi'));
    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const size = Math.min(100, Math.max(1, Math.trunc(Number(q.pageSize)) || 10));
    return { items: rows.slice((page - 1) * size, page * size), total: rows.length, counts };
  }

  async getPackage(id: string) {
    const p = UUID.test(id) ? (await this.loadPackages({ id }))[0] : undefined;
    if (!p) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    const dto = this.packageDto(p);
    // Như hồ sơ NCC: lần gửi ngay trước lần đang chờ bị yêu cầu chỉnh sửa thì cho Admin xem lý do để đối chiếu
    let prev: { admin_note: string | null; reviewed_date: Date | null } | null = null;
    if (dto.status === 'PENDING') {
      const [, before] = await this.prisma.package_verifications.findMany({ where: { package_id: id, status: { not: 'Draft' } }, orderBy: { created_date: 'desc' }, take: 2 });
      if (before?.status === 'NeedRevision' && (dto.reviewKind === 'UPDATE') === !!before.snapshot) prev = before;
    }
    return { ...dto, lastRevision: prev ? { note: prev.admin_note, reviewedAt: prev.reviewed_date?.toISOString() ?? null } : null };
  }

  /**
   * Duyệt (note = undefined) hoặc yêu cầu chỉnh sửa (note bắt buộc) một gói đang chờ.
   * - Gói chưa đăng: duyệt -> Approved (hiển thị), yêu cầu sửa -> NeedRevision.
   * - Bản cập nhật của gói đã đăng: duyệt -> chép bản cập nhật vào gói; yêu cầu sửa -> chỉ ghi ở dòng xác minh. Gói vẫn hiển thị.
   */
  async reviewPackage(id: string, note?: string) {
    const p = UUID.test(id) ? (await this.loadPackages({ id }))[0] : undefined;
    if (!p) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    const upd = this.sentUpdate(p);
    const isUpdate = upd?.status === 'Pending';
    if (p.status !== 'Pending' && !isUpdate) return fail('PACKAGE_NOT_PENDING', 'Chỉ xử lý được gói đang chờ duyệt.', 409);
    const revision = note !== undefined;
    const text = revision ? this.checkNote(note) : null;
    const result = revision ? { status: 'NeedRevision', admin_note: text, reviewed_date: new Date() } : { status: 'Approved', admin_note: null, reviewed_date: new Date() };
    const name = isUpdate ? upd.data.name : p.name;

    if (isUpdate) {
      const s = upd.data;
      const dropped = revision ? [] : livePhotos(p).filter((u) => !s.photos.includes(u) && u.startsWith(`vendors/${p.vendor_profiles!.id}/`));
      await this.prisma.$transaction([
        this.prisma.package_verifications.update({ where: { id: upd.id }, data: result }),
        ...(revision
          ? []
          : [
              this.prisma.service_packages.update({
                where: { id },
                data: { name: s.name, description: s.description, price: s.price, capacity: s.capacity, updated_date: new Date() },
              }),
              this.prisma.package_tags.deleteMany({ where: { package_id: id } }),
              this.prisma.package_tags.createMany({ data: s.tags.map((tag) => ({ package_id: id, tag })) }),
              this.prisma.package_albums.deleteMany({ where: { package_id: id } }),
              this.prisma.package_albums.createMany({ data: s.photos.map((url, i) => ({ package_id: id, url, display_order: i, is_cover: url === s.cover })) }),
            ]),
      ]);
      // Ảnh của bản cũ không còn trong bản mới (dòng xác minh vẫn giữ snapshot làm lịch sử nội dung)
      await this.storage.remove(ALBUM_BUCKET, dropped);
    } else {
      const pending = await this.prisma.package_verifications.findFirst({ where: { package_id: id, status: 'Pending' }, orderBy: { created_date: 'desc' } });
      await this.prisma.$transaction([
        this.prisma.service_packages.update({ where: { id }, data: { status: revision ? 'NeedRevision' : 'Approved', updated_date: new Date() } }),
        pending
          ? this.prisma.package_verifications.update({ where: { id: pending.id }, data: result })
          : this.prisma.package_verifications.create({ data: { package_id: id, ...result } }),
      ]);
    }
    await notify(this.prisma, {
      userId: p.vendor_profiles!.user_id!,
      type: revision ? 'PackageNeedRevision' : 'PackageApproved',
      title: revision ? (isUpdate ? 'Bản cập nhật gói dịch vụ cần chỉnh sửa' : 'Gói dịch vụ cần chỉnh sửa') : isUpdate ? 'Bản cập nhật gói dịch vụ đã được duyệt' : 'Gói dịch vụ đã được duyệt',
      content: revision
        ? `Quản trị viên yêu cầu chỉnh sửa ${isUpdate ? 'bản cập nhật của ' : ''}gói "${name}": ${text}`
        : isUpdate
          ? `Bản cập nhật gói "${name}" đã được duyệt và đang hiển thị với khách.`
          : `Gói "${name}" đã được duyệt và hiển thị công khai.`,
      referenceType: 'ServicePackage',
      referenceId: id,
    });
    return (await this.loadPackages({ id })).map((x) => this.packageDto(x))[0];
  }
}
