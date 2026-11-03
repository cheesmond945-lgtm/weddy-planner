import type { ServiceDetail, ServicePackage } from '@/types/catalog'

/** Ảnh của một gói: toàn bộ album cùng id gói; dữ liệu giả chỉ có ảnh xem trước hoặc ảnh bìa. */
export function imagesOf(service: ServiceDetail, pkg: ServicePackage) {
  const album = service.albums.find((a) => a.id === pkg.id)
  const list = album?.imageUrls?.length ? album.imageUrls : (album?.previewImageUrls ?? [])
  return list.length ? list : pkg.imageUrl ? [pkg.imageUrl] : []
}

/** Mô tả không nhắc lại giá (giá đã hiện riêng): bỏ các câu có số tiền "…đ". */
export const withoutPrice = (text: string) =>
  text
    .split(/(?<=[.;!?])\s+/)
    .filter((s) => !/\d[\d.,]*\s*(đ|vnđ|triệu)/i.test(s))
    // Câu đứng sau dấu ";" của câu giá vừa bỏ đang viết thường: viết hoa chữ đầu
    .map((s) => s.charAt(0).toLocaleUpperCase('vi') + s.slice(1))
    .join(' ')
    .replace(/[;,]\s*$/, '.')

/** "250 khách · Hiện đại · Pha lê": sức chứa và tối đa 2 phong cách, chữ thuần. */
export const attrsOf = (pkg: ServicePackage) => [pkg.capacity ? `${pkg.capacity} khách` : null, ...(pkg.tags ?? []).slice(0, 2)].filter(Boolean).join(' · ')
