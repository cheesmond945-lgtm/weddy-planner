import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { Paginated } from '../../common/utils/pagination';

export interface ServiceQuery {
  q?: string;
  category?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
}

/** Tên danh mục trong CSDL -> slug mà frontend dùng cho URL và icon. */
const CATEGORY_SLUGS: Record<string, string> = {
  'Chụp ảnh': 'chup-anh',
  'Hoa cưới': 'hoa-cuoi',
  'Trang điểm': 'makeup',
  Makeup: 'makeup',
  'Trang phục': 'trang-phuc',
  'Trang trí': 'decor',
  'Trung tâm tổ chức sự kiện': 'nha-hang',
};

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const categorySlug = (name: string | null) => (name ? (CATEGORY_SLUGS[name] ?? slugify(name)) : '');

/**
 * Trung tâm tổ chức sự kiện báo giá theo mâm (menu cho 10 khách), đã gồm sảnh và dịch vụ đi kèm;
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

/** Thứ tự hiển thị danh mục (như prototype): các slug lạ xếp cuối. */
export const CATEGORY_ORDER = ['nha-hang', 'decor', 'trang-phuc', 'makeup', 'chup-anh', 'co-cuoi', 'hoa-cuoi'];
export const categoryRank = (slug: string) => {
  const i = CATEGORY_ORDER.indexOf(slug);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

/**
 * Frontend gọi "dịch vụ" = nhà cung cấp (vendor_profiles) đã duyệt có ít nhất một gói Approved.
 * "Gói" của dịch vụ = service_packages; mỗi gói là một album (package_albums).
 * Rating/reviewCount (điểm Google Maps) chưa có trong CSDL nên trả 0.
 */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  /**
   * NCC khách nhìn thấy: hồ sơ Approved, tài khoản Active, có gói Approved.
   * `alsoHidden`: id các NCC đang bị ẩn (Hidden) vẫn được trả về, dành cho cặp đôi đã có đơn với NCC đó (xem withOrderWith).
   */
  private async loadVisible(alsoHidden: string[] = []) {
    return this.prisma.vendor_profiles.findMany({
      where: {
        users: { status: 'Active' },
        service_packages: { some: { status: 'Approved' } },
        OR: [{ status: 'Approved' }, ...(alsoHidden.length ? [{ status: 'Hidden', id: { in: alsoHidden } }] : [])],
      },
      orderBy: [{ created_date: 'asc' }, { id: 'asc' }],
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

  private summarize(v: Awaited<ReturnType<ServicesService['loadVisible']>>[number]) {
    const prices = v.service_packages.map((p) => Number(p.price));
    const cover = v.service_packages.flatMap((p) => p.package_albums)[0];
    const slug = categorySlug(v.service_categories!.name);
    return {
      id: v.id,
      name: v.business_name,
      category: { id: v.service_categories!.id, slug, name: v.service_categories!.name ?? '' },
      location: v.city,
      priceFrom: Math.min(...prices),
      /** TABLE: giá mỗi mâm 10 khách, đã gồm sảnh; PACKAGE: giá trọn gói */
      priceUnit: priceUnitOf(slug),
      /** Số mâm tối thiểu của gói rẻ nhất (gói xếp theo giá tăng dần) */
      minTables: v.service_packages[0]?.min_tables ?? null,
      rating: 0,
      reviewCount: 0,
      coverImageUrl: cover ? this.img(cover.url) : '',
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
    return (await this.loadVisible(hidden)).filter((v) => wanted.has(v.id)).map((v) => this.summarize(v));
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
    const q = query.q?.trim().toLowerCase();

    const items = (await this.loadVisible())
      .map((v) => this.summarize(v))
      .filter(
        (s) =>
          (!query.category || s.category.slug === query.category) &&
          (!query.location || s.location === query.location) &&
          (query.priceMin === undefined || s.priceFrom >= query.priceMin) &&
          (query.priceMax === undefined || s.priceFrom < query.priceMax) &&
          (!q || (s.name ?? '').toLowerCase().includes(q) || s.category.name.toLowerCase().includes(q)),
      );

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
    const tags = [...new Set(v.service_packages.flatMap((p) => p.package_tags.map((t) => t.tag)))];

    return {
      ...this.summarize(v),
      priceTo: Math.max(...prices),
      address: [v.address, v.ward, v.city].filter(Boolean).join(', '),
      description: v.description,
      highlights: [] as string[],
      capacity: capacities.length ? Math.max(...capacities) : null,
      styles: tags,
      workingHours: v.working_hours ?? '',
      isVerified: true,
      isGuaranteed: false,
      images: [...covers, ...others].slice(0, 60).map((a) => this.img(a.url)),
      packages: v.service_packages.map((p) => ({ id: p.id, name: p.name, description: p.description, price: Number(p.price), capacity: p.capacity, minTables: p.min_tables })),
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
