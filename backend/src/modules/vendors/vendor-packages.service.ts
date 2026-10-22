import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ALBUM_BUCKET, StorageService } from '../../integrations/storage/storage.service';
import { categorySlug } from '../catalog/services.service';
import { fileNameOfPath, mimeOfPath } from './vendor-files';

export interface SavePackageBody {
  name?: string | null;
  description?: string | null;
  price?: number | null;
  tags?: string[];
  capacity?: number | null;
  photos?: { publicId: string }[];
  coverPublicId?: string | null;
}

// Gói bị Admin yêu cầu sửa (NeedRevision) hiển thị như bản nháp để NCC sửa và gửi lại.
const STATUS_OUT: Record<string, string> = { Draft: 'DRAFT', NeedRevision: 'DRAFT', Pending: 'PENDING', Approved: 'PUBLISHED', Hidden: 'HIDDEN' };
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
      select: { id: true, status: true, service_categories: { select: { id: true, name: true } } },
    });
    if (!v) return fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
    return v;
  }

  private include = {
    package_albums: { orderBy: [{ display_order: 'asc' as const }, { id: 'asc' as const }] },
    package_tags: true,
  };

  /** Gói thuộc NCC đang đăng nhập; không thấy hoặc của NCC khác đều là 404. */
  async loadOwned(userId: string, id: string) {
    const vendor = await this.vendorOf(userId);
    const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const pkg = ok ? await this.prisma.service_packages.findFirst({ where: { id, vendor_id: vendor.id }, include: this.include }) : null;
    if (!pkg) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    return { vendor, pkg };
  }

  private async toDto(p: PackageRow, category: { id: string; name: string }) {
    const photos = await Promise.all(
      p.package_albums.map(async (a) => {
        const url = this.storage.publicAlbumUrl(a.url);
        const size = await fetch(url, { method: 'HEAD' }).then((r) => Number(r.headers.get('content-length')) || 0).catch(() => 0);
        return { url, publicId: a.url, fileName: fileNameOfPath(a.url), size, mimeType: mimeOfPath(a.url) };
      }),
    );
    const cover = p.package_albums.find((a) => a.is_cover) ?? p.package_albums[0];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      category: { id: category.id, slug: categorySlug(category.name), name: category.name },
      status: STATUS_OUT[p.status] ?? 'DRAFT',
      tags: p.package_tags.map((t) => t.tag),
      capacity: p.capacity,
      photos,
      coverPublicId: cover?.url ?? null,
      updatedAt: p.updated_date.toISOString(),
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
    if (price === null || !Number.isInteger(price) || price <= 0) errors.price = 'Giá phải là số nguyên dương.';
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) errors.capacity = 'Sức chứa phải là số nguyên dương.';

    const tags = [...new Set((body.tags ?? []).map((t) => String(t).trim()).filter(Boolean))];
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
    return { name, description, price: price as number, capacity, tags, photos, cover };
  }

  private albumRows(packageId: string, photos: string[], cover: string | null) {
    return photos.map((url, i) => ({ package_id: packageId, url, display_order: i, is_cover: url === cover }));
  }

  async create(userId: string, body: SavePackageBody) {
    const vendor = await this.vendorOf(userId);
    const d = this.parse(body, categorySlug(vendor.service_categories.name) === 'nha-hang', vendor.id, new Set());
    const created = await this.prisma.$transaction(async (tx) => {
      const p = await tx.service_packages.create({
        data: { vendor_id: vendor.id, name: d.name, description: d.description, price: d.price, capacity: d.capacity, status: 'Draft' },
      });
      if (d.tags.length) await tx.package_tags.createMany({ data: d.tags.map((tag) => ({ package_id: p.id, tag })) });
      if (d.photos.length) await tx.package_albums.createMany({ data: this.albumRows(p.id, d.photos, d.cover) });
      return p.id;
    });
    return this.get(userId, created);
  }

  async update(userId: string, id: string, body: SavePackageBody) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    if (!EDITABLE.includes(pkg.status)) return fail('PACKAGE_NOT_EDITABLE', 'Chỉ sửa được gói ở trạng thái bản nháp.', 409);
    const d = this.parse(body, categorySlug(vendor.service_categories.name) === 'nha-hang', vendor.id, new Set(pkg.package_albums.map((a) => a.url)));
    const dropped = pkg.package_albums.map((a) => a.url).filter((u) => !d.photos.includes(u) && u.startsWith(`vendors/${vendor.id}/`));

    await this.prisma.$transaction([
      this.prisma.service_packages.update({
        where: { id },
        data: { name: d.name, description: d.description, price: d.price, capacity: d.capacity },
      }),
      this.prisma.package_tags.deleteMany({ where: { package_id: id } }),
      this.prisma.package_tags.createMany({ data: d.tags.map((tag) => ({ package_id: id, tag })) }),
      this.prisma.package_albums.deleteMany({ where: { package_id: id } }),
      this.prisma.package_albums.createMany({ data: this.albumRows(id, d.photos, d.cover) }),
    ]);
    await this.storage.remove(ALBUM_BUCKET, dropped);
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    if (!EDITABLE.includes(pkg.status)) return fail('PACKAGE_NOT_EDITABLE', 'Chỉ xóa được gói ở trạng thái bản nháp.', 409);
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
    await this.storage.remove(ALBUM_BUCKET, pkg.package_albums.map((a) => a.url).filter((u) => u.startsWith(`vendors/${vendor.id}/`)));
    return null;
  }

  async submit(userId: string, id: string) {
    const { vendor, pkg } = await this.loadOwned(userId, id);
    if (!EDITABLE.includes(pkg.status)) return fail('CONFLICT', 'Chỉ gửi duyệt được gói ở trạng thái bản nháp.', 409);

    const errors: Record<string, string> = {};
    if (!pkg.description.trim()) errors.description = 'Vui lòng nhập mô tả.';
    if (pkg.package_albums.length === 0) errors.photos = 'Cần ít nhất 1 ảnh.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Gói chưa đủ thông tin để gửi duyệt.', 400, errors);

    if (vendor.status !== 'Approved') {
      return fail('VENDOR_NOT_VERIFIED', 'Hồ sơ nhà cung cấp chưa được xác minh nên chưa gửi duyệt gói được.', 409);
    }
    await this.prisma.$transaction([
      this.prisma.service_packages.update({ where: { id }, data: { status: 'Pending' } }),
      this.prisma.package_verifications.create({ data: { package_id: id, status: 'Pending' } }),
    ]);
    return this.get(userId, id);
  }

  private async move(userId: string, id: string, from: string, to: string, message: string) {
    const { pkg } = await this.loadOwned(userId, id);
    if (pkg.status !== from) return fail('CONFLICT', message, 409);
    await this.prisma.service_packages.update({ where: { id }, data: { status: to } });
    return this.get(userId, id);
  }

  hide(userId: string, id: string) {
    return this.move(userId, id, 'Approved', 'Hidden', 'Chỉ ẩn được gói đang đăng.');
  }

  republish(userId: string, id: string) {
    return this.move(userId, id, 'Hidden', 'Approved', 'Chỉ đăng lại được gói đang ẩn.');
  }
}
