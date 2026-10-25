import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { DataTable, num, td, th } from '@/features/adminShared/components/AdminTable'
import { formatDay, formatPeriod } from '@/features/adminShared/format'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminStatement } from '@/types/admin'

interface PaymentTableProps {
  statements: AdminStatement[]
  startIndex: number
}

/** Bảng bảng kê hoa hồng: bấm một dòng để xem chi tiết. Ngày thanh toán là ngày đã trả, chưa trả thì là hạn thanh toán. */
export function PaymentTable({ statements, startIndex }: PaymentTableProps) {
  const navigate = useNavigate()
  const head = cn(th, 'whitespace-nowrap')
  return (
    <DataTable className="w-max min-w-full">
      <thead>
        <tr>
          <th className={head}>STT</th>
          <th className={head}>Mã bảng kê</th>
          <th className={head}>Nhà cung cấp</th>
          <th className={cn(head, 'text-right')}>Số đơn hàng</th>
          <th className={cn(head, 'text-right')}>Doanh thu</th>
          <th className={cn(head, 'text-right')}>Hoa hồng</th>
          <th className={head}>Ngày thanh toán</th>
          <th className={head}>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {statements.map((s, i) => {
          const open = () => navigate(paths.admin.payment(s.id))
          return (
            <tr
              key={s.id}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
              tabIndex={0}
              className="cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <td className={cn(td, 'text-muted-foreground tabular-nums')}>{startIndex + i + 1}</td>
              <td className={cn(td, 'font-mono text-[12.5px] font-semibold whitespace-nowrap text-sage')}>{s.code}</td>
              <td className={td}>
                <span className="block font-medium">{s.vendor.name}</span>
                <span className="text-[12px] text-muted-foreground">
                  {s.category.name} · kỳ {formatPeriod(s.period)}
                </span>
              </td>
              <td className={cn(td, num, 'font-semibold')}>{s.orderCount}</td>
              <td className={cn(td, num)}>{formatMoney(s.revenue)}</td>
              <td className={cn(td, num, 'font-semibold')}>{formatMoney(s.commissionAmount)}</td>
              <td className={cn(td, 'whitespace-nowrap tabular-nums', s.status === 'PAID' ? 'text-ink' : s.isOverdue ? 'text-warn' : 'text-muted-foreground')}>
                {s.status === 'PAID' ? formatDay(s.paidAt) : formatDate(s.dueDate)}
                {s.status === 'UNPAID' && <span className="block text-[11.5px]">{s.isOverdue ? 'Quá hạn' : 'Hạn thanh toán'}</span>}
              </td>
              <td className={td}>
                <Badge tone={s.status === 'PAID' ? 'done' : 'warn'}>{s.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Badge>
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
