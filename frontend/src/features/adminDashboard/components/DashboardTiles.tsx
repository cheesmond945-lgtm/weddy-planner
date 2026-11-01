import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, DollarSign, Store, TrendingUp, Users } from 'lucide-react'
import { formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdminDashboard, TrendStat } from '@/types/admin'

function Tile({ icon: Icon, label, value, stat }: { icon: LucideIcon; label: string; value: string; stat: TrendStat }) {
  const up = stat.changePct >= 0
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-5 pt-[18px] pb-[18px] shadow-portal max-sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-10 flex-none place-items-center rounded-[11px] bg-gold-soft text-gold-ink">
          <Icon className="size-[19px]" />
        </span>
        {stat.changePct !== 0 && (
          <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums', up ? 'text-sage' : 'text-warn')}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {up ? '+' : ''}
            {stat.changePct.toLocaleString('vi-VN')}%
          </span>
        )}
      </div>
      <p className="mt-4 text-[11.5px] font-medium tracking-[0.04em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 truncate text-[26px] font-semibold tracking-tight tabular-nums max-sm:text-[22px]">{value}</p>
    </div>
  )
}

/** Bốn thẻ số liệu đầu trang tổng quan. */
export function DashboardTiles({ data }: { data: AdminDashboard }) {
  return (
    <div className="mb-[30px] grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-2.5">
      <Tile icon={DollarSign} label="Hoa hồng tháng này" value={formatMoney(data.commissionThisMonth.value)} stat={data.commissionThisMonth} />
      <Tile icon={TrendingUp} label="Tổng giá trị đơn (GMV)" value={formatMoney(data.gmv.value)} stat={data.gmv} />
      <Tile icon={Users} label="Người dùng mới" value={formatNumber(data.newUsers.value)} stat={data.newUsers} />
      <Tile icon={Store} label="Nhà cung cấp hoạt động" value={formatNumber(data.activeVendors.value)} stat={data.activeVendors} />
    </div>
  )
}
