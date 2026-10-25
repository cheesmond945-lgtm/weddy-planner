import { Button } from '@/components/ui/button'
import { useVendorProfile } from '@/features/vendors/hooks'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { useAuth } from '@/store/auth'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { formatDay, formatDayTime } from '../calc'
import { PanelDialog } from './PanelDialog'

const TITLE: Record<InvoiceType, string> = { DepositReceipt: 'Giấy xác nhận cọc', FinalInvoice: 'Hóa đơn cuối' }

/**
 * Xem giấy xác nhận cọc hoặc hóa đơn cuối của đơn (Invoices). Đọc thông tin từ đơn và hồ sơ NCC, không lưu bản chụp riêng.
 * Đây không phải hóa đơn điện tử theo quy định thuế (CSDL mục 9.7).
 */
export function InvoiceDialog({ order: o, type, onClose }: { order: Order; type: InvoiceType; onClose: () => void }) {
  const { data: profile } = useVendorProfile()
  const { user } = useAuth()
  const inv = o.invoices.find((i) => i.type === type)
  const rest = o.totalAmount - o.depositAmount
  const vendorName = profile?.businessName ?? user?.name ?? 'Nhà cung cấp'
  const th = 'border-y border-line bg-surface-2 px-3 py-2 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'px-3 py-2 align-top text-[13.5px]'

  const info = (label: string, value: string) => (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13.5px]">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right font-semibold [overflow-wrap:anywhere]">{value}</b>
    </div>
  )

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={onClose}
      title={`${TITLE[type]} ${inv?.invoiceCode ?? ''}`}
      subtitle={`Đơn ${o.orderCode}${inv ? ` · phát hành ${formatDayTime(inv.createdDate)}` : ''}`}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      {info('Nhà cung cấp', vendorName)}
      {info('Khách hàng', o.customerName)}
      {info('Số điện thoại', o.customerPhone || '—')}
      {info('Đơn dịch vụ', o.orderCode)}
      {info('Ngày thực hiện', formatDate(o.eventDate))}

      {type === 'FinalInvoice' && (
        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[420px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Hạng mục</th>
                <th className={`${th} text-right`}>SL</th>
                <th className={`${th} text-right`}>Thành tiền</th>
              </tr>
            </thead>
            <tbody className="[&_tr+tr]:border-t [&_tr+tr]:border-line">
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td className={td}>
                    {i.itemName} <span className="text-muted-foreground">({formatMoney(i.unitPrice)}/{i.unit})</span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{i.quantity}</td>
                  <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{formatMoney(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 rounded-md bg-surface-2 px-4 py-3">
        {info('Tổng giá trị đơn', formatMoney(o.totalAmount))}
        {info(
          type === 'DepositReceipt' ? 'Đã nhận cọc (VNPay)' : 'Đã cọc (VNPay)',
          `${formatMoney(o.depositAmount)}${o.payment?.paidDate ? ` · ${formatDay(o.payment.paidDate)}` : ''}`,
        )}
        {o.payment?.transactionCode && info('Mã giao dịch', o.payment.transactionCode)}
        {info(type === 'DepositReceipt' ? 'Còn lại, trả tiền mặt trực tiếp cho NCC' : 'Đã thanh toán tiền mặt', formatMoney(rest))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        {type === 'DepositReceipt'
          ? 'Hệ thống chỉ ghi nhận khoản cọc qua VNPay; phần còn lại thanh toán trực tiếp ngoài hệ thống.'
          : 'Số tiền còn lại được trả bằng tiền mặt ngoài hệ thống, không có giao dịch trên hệ thống.'}{' '}
        Chứng từ này không phải hóa đơn điện tử theo quy định thuế.
      </p>
    </PanelDialog>
  )
}
