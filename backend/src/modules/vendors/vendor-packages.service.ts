import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { ALBUM_BUCKET, StorageService } from '../../integrations/storage/storage.service';
import { GUESTS_PER_TABLE, categorySlug } from '../catalog/services.service';
import { fileNameOfPath, mimeOfPath } from './vendor-files';
import { hasChanges, livePhotos, liveSnapshot, openUpdate, UPDATE_STATUS_OUT, type PackageSnapshot } from './package-update';

export interface SavePackageBody {
  name?: string | null;
  description?: string | null;
  price?: number | null;
  tags?: string[];
  capacity?: number | null;
  /** Trung tâm sự kiện: số mâm tối thiểu để được kèm sảnh (giá gói là giá mỗi mâm) */
  minTables?: number | null;
  photos?: { publicId: string }[];
  coverPublicId?: string | null;
}

// Gói bị Admin yêu cầu sửa (NeedRevision) hiện nhãn riêng "Cần chỉnh sửa"; vẫn sửa được và gửi lại như bản nháp.
const STATUS_OUT: Record<string, string> = { Draft: 'DRAFT', NeedRevision: 'NEEDS_REVISION', Pending: 'PENDING', Approved: 'PUBLISHED', Hidden: 'HIDDEN' };
const EDITABLE = ['Draft', 'NeedRevision'];
const MAX_PHOTOS = 30;

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const toInt = (x: unknown) => (x === null || x === undefined || x === '' ? null : Number(x));

type PackageRow = NonNullable<Awaited<ReturnType<VendorPackagesService['loadOwned']>>>['pkg'];

@Injectable()
export class VendorPackagesService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({
      where: { user_id: userId },
      select: { id: true, status: true, business_name: true, service_categories: { select: { id: true, name: true } } },
    });
    if (!v) return fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
    const cat = v.service_categories;
    if (!cat) return fail('VENDOR_PROFILE_NOT_FOUND', 'Hồ sơ nhà cung cấp chưa có lĩnh vực.', 404);
    return { ...v, service_categories: { id: cat.id, name: cat.name ?? '' } };
  }

  private include = {
    package_albums: { orderBy: [{ display_order: 'asc' as const }, { id: 'asc' as const }] },
    package_tags: true,
    package_verifications: { orderBy: { created_date: 'desc' as const }, take: 1 },
  };

  /** Gói thuộc NCC đang đăng nhập; không thấy hoặc của NCC khác đều là 404. */
  async loadOwned(userId: string, id: string) {
    const vendor = await this.vendorOf(userId);
    const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const pkg = ok ? await this.prisma.service_packages.findFirst({ where: { id, vendor_id: vendor.id }, include: this.include }) : null;
    if (!pkg) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    return { vendor, pkg };
  }

  private files(paths: string[]) {
    return Promise.all(
      paths.map(async (path) => {
        const url = this.storage.publicAlbumUrl(path);
        const size = await fetch(url, { method: 'HEAD' }).then((r) => Number(r.headers.get('content-length')) || 0).catch(() => 0);
        return { url, publicId: path, fileName: fileNameOfPath(path), size, mimeType: mimeOfPath(path) };
      }),
    );
  }

  private async toDto(p: PackageRow, category: { id: string; name: string }) {
    const live = liveSnapshot(p);
    const upd = openUpdate(p);
    return {
      id: p.id,
      name: live.name,
      description: live.description,
      price: live.price,
      category: { id: category.id, slug: categorySlug(category.name), name: category.name },
      status: STATUS_OUT[p.status ?? ''] ?? 'DRAFT',
      /** Lý do Admin yêu cầu chỉnh sửa: gói chưa đăng bị trả về, hoặc bản cập nhật của gói đã đăng bị trả về */
      reviewNote: p.status === 'NeedRevision' ? (p.package_verifications[0]?.admin_note ?? null) : upd?.status === 'NeedRevision' ? upd.admin_note : null,
      tags: live.tags,
      capacity: live.capacity,
      minTables: live.minTables ?? null,
      photos: await this.files(live.photos),
      coverPublicId: live.cover,
      /** Bản cập nhật của gói đã đăng (khách vẫn thấy bản đang đăng ở các trường trên cho tới khi Admin duyệt) */
      pendingUpdate: upd
        ? {
            status: UPDATE_STATUS_OUT[upd.status],
            name: upd.data.name,
            description: upd.data.description,
            price: upd.data.price,
            tags: upd.data.tags,
            capacity: upd.data.capacity,
            minTables: upd.data.minTables ?? null,
            photos: await this.files(upd.data.photos),
            coverPublicId: upd.data.cover,
            savedAt: upd.data.savedAt,
          }
        : null,
      updatedAt: upd?.data.savedAt ?? p.updated_date?.toISOString() ?? '',
    };
  }

  async list(userId: string) {
    const vendor = await this.vendorOf(userId);
    const rows = await this.prisma.service_packages.findMany({
      where: { vendor_id: vendor.id },
      include: this.include,
      orderBy: [{ updated_date: 'desc' }, { id: 'asc' }],
    });
    return Promise.all(rows.map((p) => this.toDto(p, vendor.service_categories)));
  }

  async get(userId: string, id: string) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    return this.toDto(pkg, vendor.service_categories);
  }

  /** Kiểm tra và chuẩn hóa dữ liệu lưu nháp. */
  private parse(body: SavePackageBody, isRestaurant: boolean, vendorId: string, ownedPaths: Set<string>) {
    const errors: Record<string, string> = {};
    const name = body.name?.trim() ?? '';
    if (!name) errors.name = 'Vui lòng nhập tên gói.';
    else if (name.length > 200) errors.name = 'Tối đa 200 ký tự.';

    const price = toInt(body.price);
    const capacity = isRestaurant ? toInt(body.capacity) : null;
    const minTables = isRestaurant ? toInt(body.minTables) : null;
    if (price === null || !Number.isInteger(price) || price <= 0) errors.price = 'Giá phải là số nguyên dương.';
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) errors.capacity = 'Sức chứa phải là số nguyên dương.';
    if (minTables !== null && (!Number.isInteger(minTables) || minTables <= 0)) errors.minTables = 'Số mâm tối thiểu phải là số nguyên dương.';
    // Mỗi mâm 10 khách: số mâm tối thiểu không vượt quá số mâm sảnh chứa được
    else if (minTables !== null && capacity !== null && Number.isInteger(capacity) && minTables * GUESTS_PER_TABLE > capacity) {
      errors.minTables = `Sảnh ${capacity} khách chứa tối đa ${Math.floor(capacity / GUESTS_PER_TABLE)} mâm.`;
    }

    // Tag viết hoa chữ cái đầu, không trùng
    const tags = [...new Set((body.tags ?? []).map((t) => String(t).trim()).filter(Boolean).map((t) => t.charAt(0).toLocaleUpperCase('vi') + t.slice(1)))];
    if (tags.some((t) => t.length > 50)) errors.tags = 'Mỗi thẻ tối đa 50 ký tự.';

    const photos = (body.photos ?? []).map((p) => p.publicId);
    if (photos.length > MAX_PHOTOS) errors.photos = `Tối đa ${MAX_PHOTOS} ảnh.`;
    else if (new Set(photos).size !== photos.length) errors.photos = 'Có ảnh bị trùng.';
    else if (photos.some((p) => typeof p !== 'string' || !(p.startsWith(`vendors/${vendorId}/packages/`) || ownedPaths.has(p)))) {
      errors.photos = 'Ảnh không hợp lệ, hãy tải lên lại.';
    }
    const description = body.description?.trim() ?? '';

    if (Object.keys(errors).length) fail('VALIDATION_ERROR', 'Thông tin gói chưa hợp lệ.', 400, errors);
    const cover = body.coverPublicId && photos.includes(body.coverPublicId) ? body.coverPublicId : (photos[0] ?? null);
    return { name, description, price: price as number, capacity, minTables, tags, photos, cover };
  }

  private albumRows(packageId: string, photos: string[], cover: string | null) {
    return photos.map((url, i) => ({ package_id: packageId, url, display_order: i, is_cover: url === cover }));
  }

  async create(userId: string, body: SavePackageBody) {
    const vendor = await this.vendorOf(userId);
    // Chỉ NCC có hồ sơ đã duyệt mới thêm được gói dịch vụ
    if (vendor.status !== 'Approved') {
      return fail('VENDOR_NOT_VERIFIED', 'Hồ sơ nhà cung cấp chưa được duyệt nên chưa thêm được gói dịch vụ.', 409);
    }
    const d = this.parse(body, categorySlug(vendor.service_categories.name) === 'nha-hang', vendor.id, new Set());
    const created = await this.prisma.$transaction(async (tx) => {
      const p = await tx.service_packages.create({
        data: { vendor_id: vendor.id, name: d.name, description: d.description, price: d.price, capacity: d.capacity, min_tables: d.minTables, status: 'Draft' },
      });
      if (d.tags.length) await tx.package_tags.createMany({ data: d.tags.map((tag) => ({ package_id: p.id, tag })) });
      if (d.photos.length) await tx.package_albums.createMany({ data: this.albumRows(p.id, d.photos, d.cover) });
      return p.id;
    });
    return this.get(userId, created);
  }

  /**
   * Gợi ý đoạn mô tả gói từ tên, tags, giá, sức chứa. Chưa nối mô hình AI (integrations/ai còn trống):
   * dựng đoạn mẫu để NCC chỉnh lại.
   */
  async suggestDescription(userId: string, body: { name?: string | null; tags?: string[]; price?: number | null; capacity?: number | null }) {
    const vendor = await this.vendorOf(userId);
    const name = body.name?.trim() || 'Gói dịch vụ này';
    const field = vendor.service_categories.name.toLowerCase();
    const tags = (body.tags ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 5);
    const price = Number(body.price);
    const capacity = Number(body.capacity);
    const parts = [
      `${name} là gói ${field} dành cho tiệc cưới, được thiết kế gọn gàng và dễ tùy chỉnh theo nhu cầu của cặp đôi.`,
      tags.length ? `Điểm nhấn: ${tags.join(', ')}.` : null,
      capacity > 0 ? `Phù hợp tới khoảng ${capacity} khách.` : null,
      price > 0 ? `Giá từ ${price.toLocaleString('vi-VN')}đ, có thể điều chỉnh theo yêu cầu cụ thể.` : null,
      'Liên hệ để được tư vấn chi tiết và nhận báo giá phù hợp.',
    ];
    return { description: parts.filter(Boolean).join(' ') };
  }

  /**
   * Lưu gói.
   * - Bản nháp / Cần chỉnh sửa (chưa đăng): ghi thẳng vào gói.
   * - Đã đăng: ghi vào bản cập nhật (dòng xác minh Draft, hoặc dòng NeedRevision đang sửa), bản đang đăng giữ nguyên.
   * - Chờ duyệt, đang ẩn, hoặc bản cập nhật đang chờ duyệt: không sửa được (409).
   */
  async update(userId: string, id: string, body: SavePackageBody) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    if (pkg.status === 'Approved') return this.saveUpdate(userId, vendor, pkg, body);
    if (pkg.status === 'Hidden') return fail('PACKAGE_NOT_EDITABLE', 'Gói đang ẩn. Khôi phục gói trước khi cập nhật.', 409);
    if (!EDITABLE.includes(pkg.status ?? '')) return fail('PACKAGE_NOT_EDITABLE', 'Gói đang chờ duyệt, không thể chỉnh sửa.', 409);
    const d = this.parse(body, categorySlug(vendor.service_categories.name) === 'nha-hang', vendor.id, new Set(livePhotos(pkg)));
    const dropped = livePhotos(pkg).filter((u) => !d.photos.includes(u) && u.startsWith(`vendors/${vendor.id}/`));

    await this.prisma.$transaction([
      this.prisma.service_packages.update({
        where: { id },
        data: { name: d.name, description: d.description, price: d.price, capacity: d.capacity, min_tables: d.minTables },
      }),
      this.prisma.package_tags.deleteMany({ where: { package_id: id } }),
      this.prisma.package_tags.createMany({ data: d.tags.map((tag) => ({ package_id: id, tag })) }),
      this.prisma.package_albums.deleteMany({ where: { package_id: id } }),
      this.prisma.package_albums.createMany({ data: this.albumRows(id, d.photos, d.cover) }),
    ]);
    await this.storage.remove(ALBUM_BUCKET, dropped);
    return this.get(userId, id);
  }

  /** Lưu bản cập nhật của gói đã đăng. Ảnh mới chỉ nằm trong snapshot; ảnh của bản đang đăng không bị xóa. */
  private async saveUpdate(userId: string, vendor: { id: string; service_categories: { name: string } }, pkg: PackageRow, body: SavePackageBody) {
    const upd = openUpdate(pkg);
    if (upd?.status === 'Pending') return fail('PACKAGE_NOT_EDITABLE', 'Bản cập nhật đang chờ duyệt, không thể chỉnh sửa.', 409);
    const live = new Set(livePhotos(pkg));
    const d = this.parse(body, categorySlug(vendor.service_categories.name) === 'nha-hang', vendor.id, new Set([...live, ...(upd?.data.photos ?? [])]));
    const snapshot: PackageSnapshot = {
      name: d.name,
      description: d.description,
      price: d.price,
      capacity: d.capacity,
      minTables: d.minTables,
      tags: d.tags,
      photos: d.photos,
      cover: d.cover,
      savedAt: new Date().toISOString(),
    };
    await (upd
      ? this.prisma.package_verifications.update({ where: { id: upd.id }, data: { snapshot: { ...snapshot } } })
      : this.prisma.package_verifications.create({ data: { package_id: pkg.id, status: 'Draft', snapshot: { ...snapshot } } }));
    // Ảnh đã tải cho bản cập nhật rồi bỏ đi (không thuộc bản đang đăng)
    await this.storage.remove(ALBUM_BUCKET, this.unusedPhotos(vendor.id, upd?.data.photos ?? [], live, d.photos));
    return this.get(userId, pkg.id);
  }

  private unusedPhotos(vendorId: string, photos: string[], live: Set<string>, keep: string[] = []) {
    return photos.filter((u) => !live.has(u) && !keep.includes(u) && u.startsWith(`vendors/${vendorId}/`));
  }

  /** Bỏ bản cập nhật chưa gửi (hoặc bị yêu cầu chỉnh sửa) của gói đã đăng; gói giữ nguyên bản đang đăng. */
  async discardUpdate(userId: string, id: string) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    const upd = openUpdate(pkg);
    if (pkg.status !== 'Approved' || !upd || upd.status === 'Pending') return fail('CONFLICT', 'Gói không có bản cập nhật nháp để xóa.', 409);
    // Dòng bị yêu cầu chỉnh sửa giữ lại làm lịch sử duyệt, chỉ bỏ nội dung bản cập nhật
    await (upd.status === 'Draft'
      ? this.prisma.package_verifications.delete({ where: { id: upd.id } })
      : this.prisma.package_verifications.update({ where: { id: upd.id }, data: { snapshot: Prisma.DbNull } }));
    await this.storage.remove(ALBUM_BUCKET, this.unusedPhotos(vendor.id, upd.data.photos, new Set(livePhotos(pkg))));
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    if (!EDITABLE.includes(pkg.status ?? '')) return fail('PACKAGE_NOT_EDITABLE', 'Chỉ xóa được gói ở trạng thái bản nháp.', 409);
    try {
      await this.prisma.$transaction([
        this.prisma.package_verifications.deleteMany({ where: { package_id: id } }),
        this.prisma.package_tags.deleteMany({ where: { package_id: id } }),
        this.prisma.package_albums.deleteMany({ where: { package_id: id } }),
        this.prisma.service_packages.delete({ where: { id } }),
      ]);
    } catch {
      return fail('PACKAGE_NOT_EDITABLE', 'Gói đã được dùng ở nơi khác nên không thể xóa.', 409);
    }
    await this.storage.remove(ALBUM_BUCKET, livePhotos(pkg).filter((u) => u.startsWith(`vendors/${vendor.id}/`)));
    return null;
  }

  async submit(userId: string, id: string) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    if (pkg.status === 'Approved') return this.submitUpdate(userId, vendor, pkg);
    if (!EDITABLE.includes(pkg.status ?? '')) return fail('CONFLICT', 'Chỉ gửi duyệt được gói ở trạng thái bản nháp.', 409);

    const errors: Record<string, string> = {};
    if (!pkg.description?.trim()) errors.description = 'Vui lòng nhập mô tả.';
    if (pkg.package_albums.length === 0) errors.photos = 'Cần ít nhất 1 ảnh.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Gói chưa đủ thông tin để gửi duyệt.', 400, errors);

    if (vendor.status !== 'Approved') {
      return fail('VENDOR_NOT_VERIFIED', 'Hồ sơ nhà cung cấp chưa được xác minh nên chưa gửi duyệt gói được.', 409);
    }
    await this.prisma.$transaction([
      this.prisma.service_packages.update({ where: { id }, data: { status: 'Pending' } }),
      this.prisma.package_verifications.create({ data: { package_id: id, status: 'Pending' } }),
    ]);
    await this.notifyAdmins(id, pkg.name ?? '', vendor.business_name, false);
    return this.get(userId, id);
  }

  /** Báo mọi Admin có gói cần duyệt: gói mới gửi duyệt, hoặc bản cập nhật của gói đã đăng. */
  private async notifyAdmins(packageId: string, name: string, vendorName: string | null, isUpdate: boolean) {
    const admins = await this.prisma.users.findMany({ where: { role: 'Admin', status: 'Active' }, select: { id: true } });
    const who = vendorName || 'Một nhà cung cấp';
    await Promise.all(
      admins.map((a) =>
        notify(this.prisma, {
          userId: a.id,
          type: 'PackageSubmitted',
          title: isUpdate ? `Cập nhật gói chờ duyệt: ${name}` : `Gói chờ duyệt: ${name}`,
          content: isUpdate ? `${who} gửi duyệt bản cập nhật của gói ${name}. Khách vẫn thấy phiên bản đang đăng.` : `${who} gửi duyệt gói ${name}.`,
          referenceType: 'ServicePackage',
          referenceId: packageId,
        }),
      ),
    );
  }

  /** Gửi duyệt bản cập nhật của gói đã đăng; gói vẫn hiển thị bản đang đăng cho tới khi Admin duyệt. */
  private async submitUpdate(userId: string, vendor: { status: string | null; business_name: string | null }, pkg: PackageRow) {
    const upd = openUpdate(pkg);
    if (!upd) return fail('CONFLICT', 'Gói chưa có bản cập nhật để gửi duyệt.', 409);
    if (upd.status === 'Pending') return fail('CONFLICT', 'Bản cập nhật đang chờ duyệt.', 409);

    const errors: Record<string, string> = {};
    if (!upd.data.description.trim()) errors.description = 'Vui lòng nhập mô tả.';
    if (upd.data.photos.length === 0) errors.photos = 'Cần ít nhất 1 ảnh.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Gói chưa đủ thông tin để gửi duyệt.', 400, errors);
    if (!hasChanges(liveSnapshot(pkg), upd.data)) return fail('VALIDATION_ERROR', 'Bản cập nhật chưa có thay đổi nào so với gói đang đăng.', 400);
    if (vendor.status !== 'Approved') {
      return fail('VENDOR_NOT_VERIFIED', 'Hồ sơ nhà cung cấp chưa được xác minh nên chưa gửi duyệt gói được.', 409);
    }
    // Bản nháp chuyển thẳng sang chờ duyệt; bản bị yêu cầu chỉnh sửa giữ lại (lý do lần trước), tạo lần gửi mới
    await (upd.status === 'Draft'
      ? this.prisma.package_verifications.update({ where: { id: upd.id }, data: { status: 'Pending', created_date: new Date() } })
      : this.prisma.package_verifications.create({ data: { package_id: pkg.id, status: 'Pending', snapshot: { ...upd.data } } }));
    await this.notifyAdmins(pkg.id, upd.data.name, vendor.business_name, true);
    return this.get(userId, pkg.id);
  }

  private async move(userId: string, id: string, from: string, to: string, message: string) {
    const { pkg } = await this.loadOwned(userId, id);
    if (pkg.status !== from) return fail('CONFLICT', message, 409);
    if (openUpdate(pkg)?.status === 'Pending') return fail('CONFLICT', 'Gói đang chờ duyệt bản cập nhật, không thể ẩn lúc này.', 409);
    await this.prisma.service_packages.update({ where: { id }, data: { status: to } });
    return this.get(userId, id);
  }

  hide(userId: string, id: string) {
    return this.move(userId, id, 'Approved', 'Hidden', 'Chỉ ẩn được gói đang đăng.');
  }

  republish(userId: string, id: string) {
    return this.move(userId, id, 'Hidden', 'Approved', 'Chỉ khôi phục được gói đang ẩn.');
  }
}
