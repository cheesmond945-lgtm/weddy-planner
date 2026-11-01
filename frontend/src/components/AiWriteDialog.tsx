import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, RefreshCw, Sparkles, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { vendorsApi } from '@/api/vendors'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import type { AiQuota, AiSuggestion } from '@/types/ai'

export interface AiStyleOption {
  id: string
  label: string
  hint: string
  icon: LucideIcon
}

interface AiWriteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tên ô sẽ được điền (VD: "Giới thiệu", "Mô tả") */
  fieldName: string
  styles: AiStyleOption[]
  /** Gọi backend viết một đoạn theo giọng văn đã chọn (mỗi lần gọi tốn một lượt) */
  write: (styleId: string) => Promise<AiSuggestion>
  /** Bấm "Sử dụng": đưa đoạn đang chọn vào ô */
  onUse: (text: string) => void
  /** Thông tin AI sẽ dựa vào (lấy từ form), hiện cho NCC biết; ví dụ "Tên gói: Trang trí Premium" */
  facts: string[]
  /** Có lý do thì chưa cho tạo (thiếu thông tin), hiện lý do này thay cho các thẻ giọng văn */
  blocked?: string | null
}

const ddmm = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 1 + 7 * 3600_000)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Hộp thoại "Tạo với AI": chọn giọng văn, AI viết ngay trong thẻ vừa chọn, có thể "Viết lại" (tốn thêm lượt), chọn xong bấm "Sử dụng"
 * thì đoạn mới đi vào ô. Mỗi NCC có số lượt giới hạn mỗi ngày (dùng chung cho hồ sơ và gói); đoạn đã viết của các giọng khác vẫn giữ
 * trong hộp thoại để so sánh, không tốn thêm lượt khi chuyển qua lại.
 */
export function AiWriteDialog({ open, onOpenChange, fieldName, styles, write, onUse, facts, blocked }: AiWriteDialogProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const quotaKey = ['vendor-ai-quota', user?.id] as const
  const { data: quota } = useQuery({ queryKey: quotaKey, queryFn: vendorsApi.aiQuota, enabled: open && user?.role === 'VENDOR', staleTime: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { text: string; template: boolean }>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Mỗi lần mở là một phiên mới
  useEffect(() => {
    if (open) {
      setSelected(null)
      setResults({})
      setPending(null)
      setExpanded(false)
    }
  }, [open])

  const exhausted = !!quota && quota.remaining <= 0

  async function run(id: string) {
    setPending(id)
    try {
      const r = await write(id)
      setResults((prev) => ({ ...prev, [id]: { text: r.description, template: !r.aiUsed } }))
      qc.setQueryData<AiQuota>(quotaKey, { limit: r.limit, remaining: r.remaining, resetsAt: r.resetsAt })
      if (!r.aiUsed) toast('AI đang bận, đã dùng đoạn mẫu (không tính lượt). Bạn có thể bấm “Viết lại” sau ít giây.')
    } catch (e) {
      toast((e as Error).message)
      void qc.invalidateQueries({ queryKey: quotaKey })
    } finally {
      setPending(null)
    }
  }

  function choose(id: string) {
    if (pending) return
    setSelected(id)
    setExpanded(false)
    if (!results[id] && !exhausted) void run(id)
  }

  const current = selected ? results[selected] : undefined

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="flex max-h-[min(90dvh,760px)] max-w-[620px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="mb-0 border-b border-line bg-gold-soft px-6 pt-5 pr-14 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[22px]">
            <Sparkles className="size-5 text-[#7c3aed]" />
            Tạo với AI
          </DialogTitle>
          <DialogDescription className="text-[13.5px]">
            Chọn một giọng văn, AI sẽ viết phần <b className="text-ink">{fieldName}</b> dựa trên thông tin bạn đã có. Bấm “Sử dụng” để đưa vào ô.
          </DialogDescription>
          <p className={cn('mt-1.5 text-[12.5px]', exhausted ? 'font-medium text-warn' : 'text-muted-foreground')}>
            {quota
              ? exhausted
                ? `Bạn đã dùng hết ${quota.limit} lượt hôm nay. Lượt mới có từ 0 giờ ngày ${ddmm(quota.resetsAt)}.`
                : `Bạn còn ${quota.remaining}/${quota.limit} lượt hôm nay (làm mới từ 0 giờ ngày ${ddmm(quota.resetsAt)}).`
              : 'Đang kiểm tra số lượt…'}
          </p>
        </DialogHeader>

        <div className="grid gap-3 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px]">
            <b className="font-semibold">AI sẽ dựa vào thông tin bạn đã nhập:</b>
            {facts.length ? (
              <ul className="mt-1.5 grid gap-0.5 text-muted-foreground">
                {facts.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">Chưa có thông tin nào.</p>
            )}
            {blocked ? (
              <p className="mt-2 font-medium text-warn">{blocked}</p>
            ) : (
              <p className="mt-2 text-[12px] text-muted-foreground">Nhập thêm thông tin vào form rồi mở lại để AI viết cụ thể hơn.</p>
            )}
          </div>
          {styles.map(({ id, label, hint, icon: Icon }) => {
            const on = selected === id
            const result = results[id]
            const loading = pending === id
            return (
              <div key={id} className={cn('rounded-lg border bg-surface transition-colors', on ? 'border-ink shadow-portal' : 'border-line hover:border-line-strong')}>
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60" onClick={() => choose(id)} disabled={!!pending || !!blocked || (exhausted && !result)}>
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', on ? 'bg-gold-soft text-gold-ink' : 'bg-surface-2 text-muted-foreground')}>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="grid flex-1 gap-0.5">
                    <span className="text-[14.5px] font-semibold">{label}</span>
                    <span className="text-[12.5px] text-muted-foreground">{hint}</span>
                  </span>
                  <span aria-hidden className={cn('grid size-5 place-items-center rounded-full border-2', on ? 'border-ink' : 'border-line-strong')}>
                    {on && <span className="size-2.5 rounded-full bg-ink" />}
                  </span>
                </button>

                {on && (
                  <div className="border-t border-line px-4 pt-3 pb-4">
                    {loading ? (
                      <div aria-busy="true" aria-label="AI đang viết" className="grid gap-2">
                        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
                        <div className="h-3.5 w-11/12 animate-pulse rounded bg-muted" />
                        <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
                        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                          <LoaderCircle className="size-3.5 animate-spin" /> AI đang viết…
                        </p>
                      </div>
                    ) : result ? (
                      <>
                        <p className={cn('text-[14px] leading-relaxed whitespace-pre-line', !expanded && 'line-clamp-5')}>{result.text}</p>
                        {result.text.length > 260 && (
                          <button type="button" className="mt-1 text-[13px] font-medium underline underline-offset-2" onClick={() => setExpanded((v) => !v)}>
                            {expanded ? 'Thu gọn' : 'Xem thêm'}
                          </button>
                        )}
                        {result.template && <p className="mt-2 text-[12px] text-warn">Đây là đoạn mẫu vì AI đang bận.</p>}
                        <Button type="button" variant="outline" className="mt-3 h-10 w-full rounded-pill border-line-strong" disabled={exhausted || !!pending} onClick={() => void run(id)}>
                          <RefreshCw className="text-[#7c3aed]" />
                          Viết lại
                        </Button>
                      </>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">{exhausted ? 'Đã hết lượt hôm nay.' : 'Chưa có nội dung.'}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="mt-0 border-t border-line bg-surface px-6 py-4">
          <Button type="button" variant="outline" className="h-10" disabled={!!pending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            className="h-10 min-w-28"
            disabled={!current || !!pending}
            onClick={() => {
              if (!current) return
              onUse(current.text)
              onOpenChange(false)
            }}
          >
            Sử dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
