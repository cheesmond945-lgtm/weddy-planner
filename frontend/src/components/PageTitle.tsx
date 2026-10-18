import type { ReactNode } from 'react'

interface PageTitleProps {
  title: string
  description?: ReactNode
  /** Nút bên phải tiêu đề */
  actions?: ReactNode
}

/** Tiêu đề trang (.pagehead trong prototype). */
export function PageTitle({ title, description, actions }: PageTitleProps) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(24px,3.6vw,34px)] leading-[1.15]">{title}</h1>
        {description && <p className="mt-2.5 max-w-[60ch] text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
