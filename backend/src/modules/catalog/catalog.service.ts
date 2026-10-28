import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';

export interface PackageQuery {
  categoryId?: string;
  city?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Tên model/quan hệ theo kết quả `prisma db pull` (giữ nguyên tên bảng snake_case):
 * service_packages.vendor_profiles, vendor_profiles.users, vendor_profiles.service_categories,
 * service_packages.package_albums, service_packages.package_tags.
 * Nếu db pull sinh tên khác, sửa lại cho khớp trong file schema.prisma.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  // Gói khách nhìn thấy: gói Approved + NCC Approved + tài khoản NCC Active
  private visibleWhere(extra: PackageQuery = {}) {
    return {
      status: 'Approved',
      ...(extra.q && { name: { contains: extra.q, mode: 'insensitive' as const } }),
      ...((extra.minPrice || extra.maxPrice) && {
        price: { ...(extra.minPrice && { gte: extra.minPrice }), ...(extra.maxPrice && { lte: extra.maxPrice }) },
      }),
      vendor_profiles: {
        status: 'Approved',
        users: { status: 'Active' },
        ...(extra.categoryId && { category_id: extra.categoryId }),
        ...(extra.city && { city: extra.city }),
      },
    };
  }

  async categories() {
    return this.prisma.service_categories.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  async listPackages(query: PackageQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 12));
    const where = this.visibleWhere(query);

    const [total, rows] = await Promise.all([
      this.prisma.service_packages.count({ where }),
      this.prisma.service_packages.findMany({
        where,
        orderBy: { created_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          package_albums: { where: { is_cover: true }, take: 1 },
          vendor_profiles: {
            select: { id: true, business_name: true, city: true, ward: true, service_categories: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        capacity: p.capacity,
        coverUrl: p.package_albums[0] ? this.storage.publicAlbumUrl(p.package_albums[0].url) : null,
        vendor: {
          id: p.vendor_profiles!.id,
          name: p.vendor_profiles!.business_name,
          city: p.vendor_profiles!.city,
          ward: p.vendor_profiles!.ward,
        },
        category: p.vendor_profiles!.service_categories,
      })),
    };
  }

  async packageDetail(id: string) {
    const p = await this.prisma.service_packages.findFirst({
      where: { id, ...this.visibleWhere() },
      include: {
        package_albums: { orderBy: [{ is_cover: 'desc' }, { display_order: 'asc' }] },
        package_tags: true,
        vendor_profiles: {
          select: {
            id: true, business_name: true, address: true, ward: true, city: true, google_maps_url: true,
            description: true, working_hours: true, service_categories: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Không tìm thấy gói dịch vụ');
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      capacity: p.capacity,
      tags: p.package_tags.map((t) => t.tag),
      images: p.package_albums.map((a) => ({ url: this.storage.publicAlbumUrl(a.url), isCover: a.is_cover })),
      vendor: p.vendor_profiles,
    };
  }
}
