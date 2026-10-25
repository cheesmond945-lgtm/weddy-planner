import { Check, FileText, Mail, Phone, RotateCcw, Star, ThumbsDown, ThumbsUp, Trash2, User, UserPlus } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatDay } from '@/features/adminShared/format'
import { RowMenu } from '@/features/vendorPackages/components/RowMenu'
import type { ConsultationRequest, Qualification } from '@/types/admin'

export const QUALIFICATION: Record<Qualification, { label: string; badge: string; tone: BadgeTone }> = {
  UNRATED: { label: 'Chưa đánh giá', badge: 'Chưa đánh giá', tone: 'neutral' },
  QUALIFIED: { label: 'Đạt tiêu chuẩn', badge: 'Đạt tiêu chuẩn', tone: 'done' },
  UNQUALIFIED: { label: 'Chưa đạt', badge: 'Chưa đạt tiêu chuẩn', tone: 'wait' },
}

interface ConsultationCardProps {
  item: ConsultationRequest
  busy: boolean
  onContacted: (checked: boolean) => void
  /** Chọn một kết quả (hoặc đặt lại về chưa đánh giá): trang cha mở hộp xác nhận */
  onRate: (q: Qualification) => void
  onNote: () => void
  onCreateAccount: () => void
  /** Xóa yêu cầu (spam, sai thông tin): trang cha mở hộp xác nhận */
  onDelete: () => void
}

const Info = ({ icon: Icon, children }: { icon: typeof User; children: string }) => (
  <span className="flex min-w-0 items-start gap-2 text-[13.5px]">
    <Icon className="mt-0.5 size-4 flex-none text-muted-foreground" />
    <span className="break-all">{children}</span>
  </span>
)

/** Một yêu cầu tư vấn: thông tin liên hệ, đã liên hệ, đánh giá nhà cung cấp (chỉ sau khi đã liên hệ), ghi chú và tạo tài khoản. */
export function ConsultationCard({ item: c, busy, onContacted, onRate, onNote, onCreateAccount, onDelete }: ConsultationCardProps) {
  const q = QUALIFICATION[c.qualification]
  const rated = c.qualification !== 'UNRATED'
  return (
    <article className="rounded-[18px] border border-line bg-surface px-6 py-5 shadow-portal">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto] items-start gap-x-8 gap-y-3 max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <p className="inline-block rounded-md bg-gold-soft px-3 py-1 text-[12px] font-semibold tracking-[0.14em] text-gold-ink uppercase">{c.category.name}</p>
          <h3 className="mt-1.5 truncate text-[22px] leading-tight font-semibold">{c.brandName}</h3>
        </div>
        <div className="contact grid gap-2">
          <Info icon={User}>{c.contactName}</Info>
          <Info icon={Phone}>{c.phone}</Info>
          <Info icon={Mail}>{c.email}</Info>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-[13px] max-[1000px]:items-start">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 font-medium has-[:disabled]:cursor-not-allowed">
              <input
                type="checkbox"
                className="size-4 accent-sage"
                checked={c.isContacted}
                disabled={busy || c.isContacted}
                title={c.isContacted ? 'Đã liên hệ, không bỏ tích được' : undefined}
                onChange={(e) => onContacted(e.target.checked)}
              />
              Đã liên hệ
            </label>
            {!c.isContacted && !c.vendorAccountCreated && <RowMenu label={c.brandName} items={[{ label: 'Xóa yêu cầu', icon: Trash2, danger: true, onClick: onDelete }]} />}
          </div>
          <span className="text-[12px] text-muted-foreground tabular-nums">Gửi ngày {formatDay(c.createdAt)}</span>
          {c.isContacted && <span className="text-[12px] text-sage tabular-nums">Liên hệ lúc {formatDateTime(c.contactedAt)}</span>}
        </div>
      </div>

      {!c.isContacted && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dotted border-line-strong pt-4">
          <div className="min-w-0 flex-1 text-[13px]">
            {c.qualification === 'UNQUALIFIED' && <Badge tone="wait">Chưa đạt tiêu chuẩn</Badge>}
            {c.note && (
              <p className="whitespace-pre-line text-muted-foreground">
                <b className="text-ink">Ghi chú:</b> {c.note}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="rounded-pill border-line-strong" onClick={onNote}>
            <FileText />
            Ghi chú{c.note ? ' •' : ''}
          </Button>
        </div>
      )}

      {c.isContacted && (
        <div className="mt-4 grid gap-3 border-t border-dotted border-line-strong pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[13.5px] font-medium">
              <Star className="size-4 text-gold" />
              Đánh giá nhà cung cấp:
              <Badge tone={q.tone}>{q.label}</Badge>
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {!rated && (
                <>
                  <Button size="sm" disabled={busy} className="rounded-pill bg-sage text-white hover:bg-sage hover:brightness-110" onClick={() => onRate('QUALIFIED')}>
                    <ThumbsUp />
                    Đạt tiêu chuẩn
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} className="rounded-pill border-gold-strong text-gold-ink hover:bg-gold-soft" onClick={() => onRate('UNQUALIFIED')}>
                    <ThumbsDown />
                    Chưa đạt
                  </Button>
                </>
              )}
              {c.qualification === 'QUALIFIED' &&
                (c.vendorAccountCreated ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-sage-soft px-3.5 py-2 text-[13px] font-medium text-sage">
                    <Check className="size-4" />
                    Đã tạo tài khoản
                  </span>
                ) : (
                  <Button size="sm" className="rounded-pill bg-ink text-bg hover:bg-ink hover:brightness-125" onClick={onCreateAccount}>
                    <UserPlus />
                    Thêm người dùng mới
                  </Button>
                ))}
              {rated && !c.vendorAccountCreated && (
                <Button variant="ghost" size="sm" disabled={busy} className="rounded-pill text-muted-foreground" onClick={() => onRate('UNRATED')}>
                  <RotateCcw />
                  Đánh giá lại
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-pill border-line-strong" onClick={onNote}>
                <FileText />
                Ghi chú{c.note ? ' •' : ''}
              </Button>
            </div>
          </div>
          {c.qualification === 'UNQUALIFIED' && c.note && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <b className="text-ink">Ghi chú:</b> {c.note}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
