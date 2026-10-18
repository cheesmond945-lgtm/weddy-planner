import type { ReactNode } from 'react'

/** Khối nội dung có tiêu đề trong trang chi tiết (.dcard trong prototype). */
export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-[18px] rounded-2xl border border-line bg-surface px-7 py-[26px] max-[700px]:p-5">
      <h2 className="mb-3.5 border-b border-line pb-3 text-[22px]">{title}</h2>
      {children}
    </section>
  )
}
