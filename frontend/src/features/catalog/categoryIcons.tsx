import { Brush, Camera, Flower2, Landmark, Shirt, Sparkles, UtensilsCrossed, type LucideIcon, type LucideProps } from 'lucide-react'

// Mỗi danh mục một icon riêng, nét mảnh đồng bộ
const ICON_BY_SLUG: Record<string, LucideIcon> = {
  'nha-hang': Landmark,
  'co-cuoi': UtensilsCrossed,
  decor: Sparkles,
  'hoa-cuoi': Flower2,
  'trang-phuc': Shirt,
  'chup-anh': Camera,
  'trang-diem': Brush,
  makeup: Brush,
}

// Màu theo danh mục (c trong CATS của prototype), trỏ tới token --c1…--c6
const COLOR_BY_SLUG: Record<string, string> = {
  'nha-hang': 'var(--c1)',
  'co-cuoi': 'var(--c1)',
  decor: 'var(--c2)',
  'hoa-cuoi': 'var(--c2)',
  'trang-phuc': 'var(--c3)',
  'trang-diem': 'var(--c4)',
  makeup: 'var(--c4)',
  'chup-anh': 'var(--c5)',
}

/** Màu của danh mục, gán vào biến CSS --cc rồi dùng bằng text-(--cc). */
export const categoryColor = (slug: string) => COLOR_BY_SLUG[slug] ?? 'var(--c6)'

export function CategoryIcon({ slug, size = 16, ...props }: { slug: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = ICON_BY_SLUG[slug] ?? Sparkles
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" {...props} />
}
