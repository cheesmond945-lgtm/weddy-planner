import { Clock, ExternalLink, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMoney } from '@/lib/format'
import type { ServiceDetail } from '@/types/catalog'
import { mapsHref } from './GoogleMapsLink'
import { isTablePriced } from '../price'

interface ServiceSidebarProps {
  service: ServiceDetail
  /** Nút nhắn tin / thêm vào kế hoạch (module chat, plan) */
  actions?: ReactNode
  /** Ghi chú dưới các nút */
  tip?: ReactNode
}

/** Khung giá bên phải trang chi tiết (dside trong prototype). */
export function ServiceSidebar({ service, actions, tip }: ServiceSidebarProps) {
  const perTable = isTablePriced(service)
  return (
    <aside className="sticky top-[98px] rounded-[24px] border border-line bg-surface p-6 max-[900px]:static max-[900px]:order-first">
      <div className="text-center text-[13px] text-muted-foreground">{perTable ? 'Giá tham khảo mỗi mâm (10 khách)' : 'Mức giá tham khảo'}</div>
      <div className="mt-1.5 mb-1 text-center text-[26px] leading-tight font-semibold text-gold">
        {formatMoney(service.priceFrom)}
        <span className="block text-sm leading-tight font-medium text-muted-foreground">đến</span>
        {formatMoney(service.priceTo)}
      </div>
      <p className="mb-4 text-center text-[13px] text-muted-foreground">
        {perTable ? 'Giá mâm đã gồm sảnh và dịch vụ đi kèm. Menu và số mâm chốt khi trao đổi với nhà cung cấp.' : 'Nhà cung cấp xác nhận giá cuối cùng khi trao đổi.'}
      </p>

      {/* Nút ngay dưới khoảng giá: nhắn tin NCC, thêm vào kế hoạch */}
      {actions && <div className="mb-4 grid gap-2.5">{actions}</div>}

      <InfoRow
        icon={<MapPin className="size-[18px]" />}
        label="Địa chỉ"
        value={
          <a
            href={mapsHref(service)}
            target="_blank"
            rel="noopener noreferrer"
            title="Xem trên Google Maps"
            className="text-gold-700 underline underline-offset-[3px] hover:text-gold"
          >
            {service.address}
            <ExternalLink className="ml-1 inline size-3.5 align-[-2px]" aria-hidden />
            <span className="sr-only">(mở Google Maps trong tab mới)</span>
          </a>
        }
      />
      <InfoRow icon={<Clock className="size-[18px]" />} label="Giờ làm việc" value={service.workingHours} />

      {tip && <div className="mt-1.5 rounded-xl bg-accent-soft px-3.5 py-3 text-[12.5px] leading-[1.55] text-ink">{tip}</div>}
    </aside>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
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
