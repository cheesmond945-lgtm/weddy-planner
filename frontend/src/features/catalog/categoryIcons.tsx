import type { SVGProps } from 'react'

// Icon danh mục chép từ ICO trong prototype
const PATHS = {
  plate: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  arch: (
    <>
      <path d="M4 21V11a8 8 0 0116 0v10" />
      <path d="M8 21v-9a4 4 0 018 0v9" />
    </>
  ),
  lip: (
    <>
      <path d="M10 11V6l4-3v8" />
      <rect x="8" y="11" width="8" height="10" rx="1" />
    </>
  ),
  cam: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <circle cx="12" cy="13.5" r="3.5" />
      <path d="M8 7l1.5-3h5L16 7" />
    </>
  ),
  dress: <path d="M9 3l3 3 3-3 2 6-3 3 4 9H7l4-9-3-3z" />,
}

const ICON_BY_SLUG: Record<string, keyof typeof PATHS> = {
  'nha-hang': 'plate',
  'co-cuoi': 'plate',
  decor: 'arch',
  'hoa-cuoi': 'arch',
  makeup: 'lip',
  'chup-anh': 'cam',
  'trang-phuc': 'dress',
}

// Màu theo danh mục (c trong CATS của prototype), trỏ tới token --c1…--c6
const COLOR_BY_SLUG: Record<string, string> = {
  'nha-hang': 'var(--c1)',
  'co-cuoi': 'var(--c1)',
  decor: 'var(--c2)',
  'hoa-cuoi': 'var(--c2)',
  'trang-phuc': 'var(--c3)',
  makeup: 'var(--c4)',
  'chup-anh': 'var(--c5)',
}

/** Màu của danh mục, gán vào biến CSS --cc rồi dùng bằng text-(--cc). */
export const categoryColor = (slug: string) => COLOR_BY_SLUG[slug] ?? 'var(--c6)'

export function CategoryIcon({ slug, size = 13, ...props }: { slug: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[ICON_BY_SLUG[slug] ?? 'arch']}
    </svg>
  )
}
