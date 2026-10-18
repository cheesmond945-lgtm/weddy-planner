import { Clock, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMoney } from '@/lib/format'
import type { ServiceDetail } from '@/types/catalog'

interface ServiceSidebarProps {
  service: ServiceDetail
  /** Nút nhắn tin / thêm vào kế hoạch (module chat, plan) */
  actions?: ReactNode
  /** Ghi chú dưới các nút */
  tip?: ReactNode
}

/** Khung giá bên phải trang chi tiết (dside trong prototype). */
export function ServiceSidebar({ service, actions, tip }: ServiceSidebarProps) {
  return (
    <aside className="sticky top-[98px] rounded-[24px] border border-line bg-surface p-6 max-[900px]:static max-[900px]:order-first">
      <div className="text-center text-[13px] text-muted-foreground">Mức giá tham khảo</div>
      <div className="mt-1.5 mb-1 text-center text-[26px] leading-tight font-semibold text-gold">
        {formatMoney(service.priceFrom)}
        <span className="block text-sm leading-tight font-medium text-muted-foreground">đến</span>
        {formatMoney(service.priceTo)}
      </div>
      <p className="mb-4 text-center text-[13px] text-muted-foreground">Nhà cung cấp xác nhận giá cuối cùng khi trao đổi.</p>

      <InfoRow icon={<MapPin className="size-[18px]" />} label="Địa chỉ" value={service.address} />
      <InfoRow icon={<Clock className="size-[18px]" />} label="Giờ làm việc" value={service.workingHours} />

      {actions && <div className="mt-4 mb-3 grid gap-2.5">{actions}</div>}
      {tip && <div className="rounded-xl bg-accent-soft px-3.5 py-3 text-[12.5px] leading-[1.55] text-ink">{tip}</div>}
    </aside>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="mb-2.5 flex items-start gap-3 rounded-xl bg-bg px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div>
        <small className="block text-xs text-muted-foreground">{label}</small>
        <b className="text-sm font-semibold">{value}</b>
      </div>
    </div>
  )
}
