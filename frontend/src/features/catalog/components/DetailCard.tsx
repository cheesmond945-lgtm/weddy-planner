import type { ReactNode } from 'react'

interface DetailCardProps {
  title: string
  /** Dòng phụ dưới tiêu đề */
  subtitle?: string
  /** Biểu tượng trang trí bên trái tiêu đề */
  icon?: ReactNode
  children: ReactNode
}

/** Khối nội dung có tiêu đề trong trang chi tiết (.dcard trong prototype). */
export function DetailCard({ title, subtitle, icon, children }: DetailCardProps) {
  return (
    <section className="mb-[18px] rounded-2xl border border-line bg-surface px-7 py-[26px] max-[700px]:p-5">
      <div className="mb-3.5 flex items-center gap-3.5 border-b border-line pb-3">
        {icon && (
          <span aria-hidden className="shrink-0 text-gold-500">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-[22px]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}
