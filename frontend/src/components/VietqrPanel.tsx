import { Check, Copy, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/format'
import type { PayCheckResult, PayInfo } from '@/types/payment'

const POLL_MS = 5000

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label="Sao chép"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? <Check className="size-4 text-sage" /> : <Copy className="size-4" />}
    </button>
  )
}

interface VietqrPanelProps {
  info: PayInfo
  /** Gọi backend để đối chiếu với SePay; PAID thì onPaid được gọi */
  check: () => Promise<PayCheckResult>
  onPaid: () => void
}

/**
 * Mã QR VietQR + thông tin chuyển khoản. Tự hỏi backend mỗi 5 giây cho tới khi nhận được tiền (không cần khách bấm gì).
 * Việc đã nhận tiền do backend xác nhận qua SePay.
 */
export function VietqrPanel({ info, check, onPaid }: VietqrPanelProps) {
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [left, setLeft] = useState(() => Math.max(0, new Date(info.expiresAt).getTime() - Date.now()))
  const busy = useRef(false)
  const done = useRef(false)

  const run = useCallback(async () => {
    if (busy.current || done.current) return
    busy.current = true
    setChecking(true)
    try {
      const r = await check()
      if (r.status === 'PAID') {
        done.current = true
        onPaid()
      } else {
        setMessage(r.message)
      }
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [check, onPaid])

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(info.expiresAt).getTime() - Date.now())), 1000)
    return () => clearInterval(t)
  }, [info.expiresAt])

  const expired = left <= 0
  // Luôn tự kiểm tra cho tới khi đóng hộp thoại / rời trang, kể cả khi mã đã quá thời hạn hiển thị
  useEffect(() => {
    const t = setInterval(() => void run(), POLL_MS)
    return () => clearInterval(t)
  }, [run])

  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  const rows: [string, string, boolean][] = [
    ['Số tài khoản', info.accountNo, true],
    ['Chủ tài khoản', info.accountName, false],
    ['Số tiền', formatMoney(info.amount), false],
    ['Nội dung', info.content, true],
  ]

  return (
    <div className="grid grid-cols-[220px_1fr] items-start gap-5 max-[560px]:grid-cols-1 max-[560px]:justify-items-center">
      <img src={info.qrUrl} alt="Mã QR chuyển khoản" className="w-[220px] rounded-md border border-line bg-white" />
      <div className="w-full">
        {rows.map(([label, value, copy]) => (
          <div key={label} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="flex min-w-0 items-center gap-1">
              <b className="break-all text-right font-semibold">{value}</b>
              {copy && <CopyButton value={value} />}
            </span>
          </div>
        ))}
        <p className="mt-3 text-[13px] text-muted-foreground">
          Quét mã bằng app ngân hàng, giữ nguyên <b className="font-semibold text-ink">số tiền</b> và <b className="font-semibold text-ink">nội dung</b>. Hệ thống tự ghi nhận khi nhận được tiền.
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px]" aria-live="polite">
          {checking && <LoaderCircle className="size-3.5 animate-spin" />}
          {expired ? 'Mã đã quá thời hạn hiển thị. Nếu bạn đã chuyển khoản, hệ thống vẫn tự ghi nhận khi nhận được tiền.' : `Đang chờ thanh toán · còn ${mm}:${ss}`}
        </p>
        {message && <p className="mt-1 text-[13px] text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}
