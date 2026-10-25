import { CheckCircle2, CircleX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { commissionsApi } from '@/api/commissions'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { paths } from '@/routes/paths'
import type { CommissionPaymentResult } from '@/types/commission'

/** Trang VNPay chuyển về sau khi thanh toán: gửi kết quả (các tham số vnp_*) cho backend kiểm tra rồi báo kết quả cho NCC. */
export default function VendorVnpayReturnPage() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const [result, setResult] = useState<CommissionPaymentResult | null>(null)
  const [error, setError] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    commissionsApi
      .confirmPayment(Object.fromEntries(params.entries()))
      .then((r) => {
        setResult(r)
        void qc.invalidateQueries({ queryKey: ['vendor-commissions'] })
        void qc.invalidateQueries({ queryKey: ['vendor', 'notifications'] })
      })
      .catch((e: Error) => setError(e.message))
  }, [params, qc])

  const back = (
    <Button asChild>
      <Link to={paths.vendor.commissions}>Về Tài chính & đối soát</Link>
    </Button>
  )
  if (error) return <EmptyState title="Chưa xác nhận được thanh toán" description={error} action={back} />
  if (!result) return <div aria-busy="true" aria-label="Đang xác nhận thanh toán" className="mx-auto h-[260px] max-w-[560px] animate-pulse rounded-md bg-muted" />

  const ok = result.status === 'PAID'
  return (
    <div className="mx-auto grid max-w-[560px] justify-items-center gap-3 rounded-md border border-line bg-surface px-8 py-10 text-center shadow-portal">
      {ok ? <CheckCircle2 className="size-14 text-sage" strokeWidth={1.5} /> : <CircleX className="size-14 text-warn" strokeWidth={1.5} />}
      <h1 className="font-sans text-[22px] font-semibold tracking-normal">{ok ? 'Thanh toán thành công' : 'Chưa thanh toán'}</h1>
      <p className="text-muted-foreground">{result.message}</p>
      {ok && result.transactionCode && (
        <p className="text-[13.5px]">
          Mã giao dịch: <b className="font-mono">{result.transactionCode}</b>
        </p>
      )}
      <div className="mt-3">{back}</div>
    </div>
  )
}
