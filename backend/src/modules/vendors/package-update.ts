import { Prisma } from '../../generated/prisma/client';

/**
 * Bản cập nhật của gói đã đăng (package_verifications.snapshot).
 * Khách vẫn thấy bản đang đăng (các cột của service_packages, package_tags, package_albums) cho tới khi Admin duyệt bản này.
 */
export interface PackageSnapshot {
  name: string;
  description: string;
  price: number;
  capacity: number | null;
  /** Số mâm tối thiểu (trung tâm sự kiện). Snapshot lưu trước khi có trường này thì thiếu: coi là null */
  minTables?: number | null;
  tags: string[];
  /** Đường dẫn ảnh trong bucket album, theo thứ tự hiển thị */
  photos: string[];
  cover: string | null;
  savedAt: string;
}

type VerificationRow = { status: string | null; snapshot: Prisma.JsonValue | null; admin_note: string | null; created_date: Date | null };
type PackageRow<V extends VerificationRow = VerificationRow> = {
  status: string | null;
  name: string | null;
  description: string | null;
  price: Prisma.Decimal | null;
  capacity: number | null;
  min_tables: number | null;
  package_tags: { tag: string }[];
  package_albums: { url: string | null; is_cover: boolean | null }[];
  package_verifications: V[];
};

/** Trạng thái bản cập nhật trả ra API. */
export const UPDATE_STATUS_OUT: Record<string, string> = { Draft: 'DRAFT', Pending: 'PENDING', NeedRevision: 'NEEDS_REVISION' };

/** Dòng xác minh có snapshot đang chờ duyệt (dùng cho đếm số gói cần xử lý). */
export const PENDING_UPDATE = { status: 'Pending', NOT: { snapshot: { equals: Prisma.DbNull } } };

/**
 * Bản cập nhật còn mở của gói đã đăng/đang ẩn: dòng xác minh mới nhất có snapshot và chưa được duyệt.
 * Dòng không có snapshot (gói chưa đăng, dữ liệu cũ) không phải bản cập nhật.
 */
export function openUpdate<V extends VerificationRow>(p: PackageRow<V>) {
  const last = p.package_verifications[0];
  if ((p.status !== 'Approved' && p.status !== 'Hidden') || !last?.snapshot || !(last.status && last.status in UPDATE_STATUS_OUT)) return null;
  return { ...last, status: last.status, data: last.snapshot as unknown as PackageSnapshot };
}

/** Ảnh của bản đang đăng (bỏ dòng thiếu đường dẫn). */
export const livePhotos = (p: Pick<PackageRow, 'package_albums'>) => p.package_albums.map((a) => a.url).filter((u): u is string => !!u);

/** Bản đang đăng, cùng dạng với snapshot để so sánh. */
export function liveSnapshot(p: PackageRow): Omit<PackageSnapshot, 'savedAt'> {
  const cover = p.package_albums.find((a) => a.is_cover && a.url) ?? p.package_albums.find((a) => a.url);
  return {
    name: p.name ?? '',
    description: p.description ?? '',
    price: Number(p.price ?? 0),
    capacity: p.capacity,
    minTables: p.min_tables,
    tags: p.package_tags.map((t) => t.tag),
    photos: livePhotos(p),
    cover: cover?.url ?? null,
  };
}

/** Bản cập nhật có khác bản đang đăng không (tags không tính thứ tự). */
export function hasChanges(live: Omit<PackageSnapshot, 'savedAt'>, s: PackageSnapshot) {
  const tags = (t: string[]) => [...t].sort().join('\n');
  return (
    live.name !== s.name ||
    live.description !== s.description ||
    live.price !== s.price ||
    live.capacity !== s.capacity ||
    (live.minTables ?? null) !== (s.minTables ?? null) ||
    tags(live.tags) !== tags(s.tags) ||
    live.photos.join('\n') !== s.photos.join('\n') ||
    live.cover !== s.cover
  );
}
