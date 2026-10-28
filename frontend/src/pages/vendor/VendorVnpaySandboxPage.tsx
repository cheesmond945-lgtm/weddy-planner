import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { commissionsApi } from '@/api/commissions'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'

/**
 * Trang thanh toán VNPay GIẢ LẬP (chỉ dùng khi backend chưa cấu hình VNPay thật: PAYMENT_MODE=simulate).
 * Mô phỏng màn hình cổng thanh toán: "Hủy thanh toán" hoặc "Tiếp tục" rồi quay về trang kết quả như VNPay thật.
 */
export default function VendorVnpaySandboxPage() {
  const [params] = useSearchParams()
  const ref = params.get('ref') ?? ''
  const navigate = useNavigate()
  const [info, setInfo] = useState<{ code: string; amount: number; vendorName: string } | null>(null)
  const [error, setError] = useState('')
  const [left, setLeft] = useState(15 * 60)

  useEffect(() => {
    commissionsApi.intent(ref).then(setInfo).catch((e: Error) => setError(e.message))
  }, [ref])
  useEffect(() => {
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const back = (code: '00' | '24') =>
    navigate(`${paths.vendor.commissions}/vnpay-return?vnp_TxnRef=${encodeURIComponent(ref)}&vnp_ResponseCode=${code}`, { replace: true })

  if (error) {
    return (
      <EmptyState
        title="Phiên thanh toán không hợp lệ"
        description={error}
        action={
          <Button asChild>
            <Link to={paths.vendor.commissions}>Về Tài chính & đối soát</Link>
          </Button>
        }
      />
    )
  }
  if (!info) return <div aria-busy="true" className="mx-auto h-[420px] max-w-[880px] animate-pulse rounded-md bg-muted" />

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="mx-auto max-w-[880px] rounded-md border border-line bg-surface shadow-portal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <strong className="font-sans text-[18px] tracking-wide text-[#1d4f91]">VNPAY<span className="text-[#e11d2f]">QR</span></strong>
          <span className="rounded-pill bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">Giả lập, không trừ tiền thật</span>
        </div>
        <span className="text-[13px] text-muted-foreground">
          Giao dịch hết hạn sau{' '}
          <b className="rounded-sm bg-ink px-2 py-1 text-white tabular-nums">
            {mm} : {ss}
          </b>
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 p-6 max-md:grid-cols-1">
        <aside className="rounded-md bg-surface-2 p-5 text-[13.5px]">
          <h2 className="mb-4 border-b border-line pb-3 font-sans text-[18px] font-semibold tracking-normal">Thông tin đơn hàng (Test)</h2>
          <dl className="grid gap-3">
            <div>
              <dt className="text-muted-foreground">Số tiền thanh toán</dt>
              <dd className="text-[22px] font-bold text-[#1d4f91] tabular-nums">{formatMoney(info.amount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phí giao dịch</dt>
              <dd>0đ</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mã đơn hàng</dt>
              <dd className="font-mono text-[12.5px] [overflow-wrap:anywhere]">{ref}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nội dung</dt>
              <dd>
                Hoa hồng {info.code} - {info.vendorName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nhà cung cấp dịch vụ</dt>
              <dd>WebPlan</dd>
            </div>
          </dl>
        </aside>

        <section className="grid content-start gap-4">
          <h2 className="text-center font-sans text-[18px] font-semibold tracking-normal">Thanh toán qua Ngân hàng NCB (giả lập)</h2>
          <p className="border-b-2 border-[#1d4f91] pb-2 text-center text-[13.5px] font-medium">Thẻ nội địa</p>
          <div className="grid gap-1.5 text-[13px]">
            <span className="font-medium">Số thẻ</span>
            <input disabled value="9704198526191432198" className="h-10 rounded-sm border border-line-strong bg-surface-2 px-3" readOnly />
            <span className="mt-1 font-medium">Tên chủ thẻ</span>
            <input disabled value="NGUYEN VAN A" className="h-10 rounded-sm border border-line-strong bg-surface-2 px-3" readOnly />
            <span className="mt-1 font-medium">Ngày phát hành</span>
            <input disabled value="07/15" className="h-10 w-40 rounded-sm border border-line-strong bg-surface-2 px-3" readOnly />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11 border-line-strong" onClick={() => back('24')}>
              Hủy thanh toán
            </Button>
            <Button className="h-11" onClick={() => back('00')} disabled={left === 0}>
              Tiếp tục
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-4" />
            Trang mô phỏng cổng VNPay để thử luồng. Cấu hình VNPay thật trong backend/.env để thanh toán qua cổng thật.
          </p>
        </section>
      </div>
    </div>
  )
}
