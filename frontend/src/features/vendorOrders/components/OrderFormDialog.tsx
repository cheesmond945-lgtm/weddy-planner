import { AlertCircle, BellRing, ChevronDown, LoaderCircle, MessageSquare } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWeddingReminder } from '@/features/vendorChat/hooks'
import { isVenue } from '@/features/vendorPackages/constants'
import { usePackages } from '@/features/vendorPackages/hooks'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { UnsavedChangesGuard } from '@/features/vendors/components/UnsavedChangesGuard'
import { todayVN } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import { DEPOSIT_MIN, DEPOSIT_PERCENT_MIN, DEPOSIT_ROUNDING, depositOf } from '@/lib/deposit'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VendorConversation } from '@/types/vendorConversation'
import type { Order } from '@/types/vendorOrder'
import { emptyValues, formatDay, filledItems, sameValues, toContent, totalOf, valuesFromOrder, valuesOfOrder, type OrderFormValues } from '../calc'
import { CHANGE_LABEL } from '../constants'
import { eventDateAdvice } from '../eventDate'
import { useSaveOrder, type SaveOrderInput } from '../hooks'
import { validateDraft, validateOrder, type OrderErrors } from '../validation'
import { OrderItemsEditor, type QuickFillPackage } from './OrderItemsEditor'
import { PanelDialog } from './PanelDialog'

/**
 * new: đơn mới. draft: mở lại bản nháp. resend: "Cập nhật đơn" (Pending, NeedRevision).
 * edit: sửa đơn đã cọc (khóa tỷ lệ và tiền cọc). again: "Tạo lại đơn" (đơn hết hạn).
 */
export type OrderFormMode =
  | { kind: 'new' }
  | { kind: 'draft'; order: Order }
  | { kind: 'resend'; order: Order }
  | { kind: 'edit'; order: Order }
  | { kind: 'again'; from: Order }

interface OrderFormDialogProps {
  conversationId: string
  customer: VendorConversation['customer']
  mode: OrderFormMode
  onClose: () => void
  /** Gửi hoặc cập nhật thành công (để cuộn tới thẻ đơn) */
  onSent?: (order: Order) => void
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-[18px] border-b border-line pb-[18px] last:mb-0 last:border-b-0 last:pb-1">
      <h4 className="mb-3 flex flex-wrap items-baseline gap-2.5 font-sans text-[15px] font-semibold tracking-normal">
        {title}
        {hint && <span className="text-[12.5px] font-normal text-muted-foreground">{hint}</span>}
      </h4>
      {children}
    </section>
  )
}

const scrollToError = () =>
  requestAnimationFrame(() => document.querySelector('[role=dialog] [data-field-error], [role=dialog] [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))

interface ScheduleProps {
  percent: number
  onPercent: (n: number) => void
  error?: string
  /** Tổng đơn quá nhỏ để đặt cọc (chặn Gửi đơn, vẫn Lưu nháp) */
  depositError?: string
  deposit: number
  rest: number
  /** Sửa sau cọc: ô tỷ lệ bị khóa, số tiền cọc đã chốt */
  locked: boolean
  paidDate: string | null
  eventDate: string
  disabled: boolean
}

/**
 * Lịch thanh toán đúng 2 đợt cố định (CSDL mục 9.6): không thêm, không xóa đợt.
 * Đợt 1 (đặt cọc): NCC nhập tỷ lệ % ngay trong dòng; số tiền là ước tính, hệ thống tính chính thức khi gửi đơn.
 * Đợt 2 (phần còn lại): tỷ lệ = 100 − tỷ lệ cọc, số tiền = tổng − tiền cọc, chỉ để xem.
 */
function ScheduleTable({ percent, onPercent, error, depositError, deposit, rest, locked, paidDate, eventDate, disabled }: ScheduleProps) {
  const th = 'px-3 py-2 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'px-3 py-2.5 align-top text-[13.5px]'
  const valid = percent > 0 && percent < 100
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="bg-surface-2">
          <tr>
            <th className={th}>Đợt</th>
            <th className={cn(th, 'w-[130px]')}>Tỷ lệ</th>
            <th className={th}>Số tiền</th>
            <th className={th}>Hạn</th>
            <th className={th}>Phương thức</th>
          </tr>
        </thead>
        <tbody className="[&_tr+tr]:border-t [&_tr+tr]:border-line">
          <tr>
            <td className={cn(td, 'pt-4')}>
              <b className="font-semibold">Đợt 1 · Đặt cọc</b>
            </td>
            <td className={td}>
              <div className="relative">
                <Input
                  className={cn(controlClass, 'h-[38px] w-[104px] pr-8 text-right tabular-nums')}
                  type="number"
                  min={DEPOSIT_PERCENT_MIN}
                  max={99}
                  step={1}
                  aria-label="Tỷ lệ đặt cọc (%)"
                  aria-invalid={error ? true : undefined}
                  disabled={locked || disabled}
                  value={percent || ''}
                  onChange={(e) => onPercent(Number(e.target.value) || 0)}
                />
                <span className="pointer-events-none absolute top-1/2 left-[78px] -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
              </div>
              {error && (
                <span role="alert" data-field-error className="mt-1 block max-w-[130px] text-xs leading-snug text-destructive">
                  {error}
                </span>
              )}
              {locked && <span className="mt-1 block text-xs text-muted-foreground">Đã khóa</span>}
            </td>
            <td className={td}>
              <b className="block font-semibold whitespace-nowrap tabular-nums">{locked || !valid ? formatMoney(deposit) : `≈ ${formatMoney(deposit)}`}</b>
              <span className="text-xs text-muted-foreground">
                {locked ? 'Tiền cọc đã chốt' : `ước tính, hệ thống tính chính thức khi gửi (làm tròn ${formatMoney(DEPOSIT_ROUNDING)}, tối thiểu ${formatMoney(DEPOSIT_MIN)})`}
              </span>
            </td>
            <td className={td}>{paidDate ? `Đã cọc ${formatDay(paidDate)}` : '1 ngày sau khi gửi đơn'}</td>
            <td className={td}>VNPay (trực tuyến)</td>
          </tr>
          <tr>
            <td className={td}>
              <b className="font-semibold">Đợt 2 · Thanh toán phần còn lại</b>
            </td>
            <td className={cn(td, 'tabular-nums')}>{valid ? `${100 - percent}%` : '—'}</td>
            <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(rest)}</td>
            <td className={td}>{eventDate ? `${formatDate(eventDate)} (trả muộn tới +7 ngày)` : 'Ngày sự kiện (trả muộn tới +7 ngày)'}</td>
            <td className={td}>Tiền mặt, trả trực tiếp cho NCC</td>
          </tr>
        </tbody>
      </table>
      {depositError && (
        <p role="alert" data-field-error className="border-t border-line bg-warn-soft px-3 py-2 text-[12.5px] text-destructive">
          {depositError}
        </p>
      )}
      <p className="border-t border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground">
        Cọc tối thiểu {DEPOSIT_PERCENT_MIN}% tổng đơn. Hệ thống chỉ ghi nhận khoản cọc qua VNPay; khách quá 24 giờ chưa cọc thì đơn tự hủy (hết hạn).
      </p>
    </div>
  )
}

/**
 * Form đơn trong khung chat (Orders, OrderItems). NCC nhập hạng mục, tỷ lệ cọc, ngày sự kiện, ghi chú;
 * tiền cọc hiển thị "ước tính" (backend là nơi tính chính thức, làm tròn đến 100.000đ).
 */
export function OrderFormDialog({ conversationId, customer, mode, onClose, onSent }: OrderFormDialogProps) {
  const save = useSaveOrder()
  const reminder = useWeddingReminder(conversationId)
  const { data: packages } = usePackages()
  const order = mode.kind === 'draft' || mode.kind === 'resend' || mode.kind === 'edit' ? mode.order : null
  const locked = mode.kind === 'edit'
  const [initial] = useState<OrderFormValues>(() =>
    mode.kind === 'new' ? emptyValues(customer) : mode.kind === 'again' ? valuesFromOrder(mode.from) : valuesOfOrder(mode.order),
  )
  const [values, setValues] = useState(initial)
  const [checked, setChecked] = useState(false)
  // Lưu nháp bắt nhập ngày sự kiện (để BE không tự đặt thành ngày hôm nay)
  const [needDate, setNeedDate] = useState(false)
  const [formError, setFormError] = useState('')
  // BE trả WEDDING_NOT_SET: khách chưa điền thông tin đám cưới, chưa tạo được đơn
  const [noWedding, setNoWedding] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [showRequest, setShowRequest] = useState(true)
  // Hộp xác nhận trước khi gửi đơn, gửi bản cập nhật hoặc lưu chỉnh sửa
  const [confirmSend, setConfirmSend] = useState(false)
  // Sửa sau cọc: nội dung thay đổi, khách sẽ thấy (lưu vào OrderRevisions AfterDeposit)
  const [changeNote, setChangeNote] = useState('')

  // Ngày cưới của khách: ngày thực hiện không được sau ngày này (backend kiểm lại, 422 EVENT_DATE_AFTER_WEDDING)
  const weddingDate = customer.weddingDate ?? (order ?? (mode.kind === 'again' ? mode.from : null))?.weddingDate ?? null
  const categorySlug = (order ?? (mode.kind === 'again' ? mode.from : null))?.category?.slug ?? packages?.[0]?.category?.slug ?? null
  const busy = save.isPending
  const dirty = !sameValues(values, initial)
  const items = filledItems(values.items)
  const total = totalOf(items)
  const deposit = locked ? order!.depositAmount : depositOf(total, values.depositPercent)
  // Quy tắc kiểm khi Gửi đơn / Cập nhật đơn / Chỉnh sửa; Lưu nháp chỉ cần ngày sự kiện
  const rules = {
    minTotal: locked ? order!.depositAmount : undefined,
    changeNote: locked ? changeNote : undefined,
    originalEventDate: mode.kind === 'resend' || mode.kind === 'edit' ? mode.order.eventDate : undefined,
    deposit: !locked,
    weddingDate,
    afterDeposit: locked,
  }
  const advice = eventDateAdvice({ eventDate: values.eventDate, weddingDate, today: todayVN(), categorySlug })
  const errors: OrderErrors = checked
    ? validateOrder(values, rules)
    : needDate
      ? validateDraft(values)
      : {}
  const request = order?.revisions.find((r) => r.status === 'Requested')
  const canDraft = mode.kind === 'new' || mode.kind === 'again' || mode.kind === 'draft'

  const quickFill: QuickFillPackage[] = (packages ?? [])
    .filter((p) => p.status === 'PUBLISHED')
    .map((p) => ({ id: p.id, name: p.name, price: p.price, unit: isVenue(p.category) ? 'Bàn' : 'Gói' }))

  const set = (patch: Partial<OrderFormValues>) => setValues((v) => ({ ...v, ...patch }))

  function run(input: SaveOrderInput, notify: boolean) {
    save.mutate(input, {
      onSuccess: (o) => {
        if (notify) onSent?.(o)
        onClose()
      },
      onError: (e) => {
        if (e instanceof ApiError && e.code === 'WEDDING_NOT_SET') {
          setNoWedding(true)
          setFormError('Khách chưa điền thông tin đám cưới nên chưa tạo đơn được.')
        } else {
          const first = e instanceof ApiError && e.details && typeof e.details === 'object' ? Object.values(e.details as Record<string, unknown>).find((v) => typeof v === 'string') : undefined
          // Chi tiết trùng nội dung thông báo (vd. ngày thực hiện sau ngày cưới) thì không in hai lần
          setFormError(e.message ? `${e.message}${first && first !== e.message ? ` ${first}` : ''}` : 'Không lưu được đơn. Dữ liệu vẫn được giữ, vui lòng thử lại.')
        }
      },
    })
  }

  function saveDraft() {
    setFormError('')
    setNoWedding(false)
    if (Object.keys(validateDraft(values)).length) {
      setNeedDate(true)
      scrollToError()
      return
    }
    const content = toContent(values)
    run(mode.kind === 'draft' ? { kind: 'draft', orderId: mode.order.id, content } : { kind: 'create', conversationId, content, send: false }, false)
  }

  function submit() {
    setFormError('')
    setNoWedding(false)
    setChecked(true)
    if (Object.keys(validateOrder(values, rules)).length) {
      scrollToError()
      return
    }
    if ((mode.kind === 'resend' || mode.kind === 'edit') && !dirty) {
      setFormError(mode.kind === 'resend' ? 'Chưa có thay đổi nào so với đơn đang gửi.' : 'Chưa có thay đổi nào so với đơn hiện tại.')
      return
    }
    setConfirmSend(true)
  }

  function doSend() {
    const content = toContent(values)
    if (mode.kind === 'edit') run({ kind: 'edit', orderId: mode.order.id, content, changeNote: changeNote.trim() }, true)
    else if (mode.kind === 'resend') run({ kind: 'send', orderId: mode.order.id, content, resend: true }, true)
    else if (mode.kind === 'draft') run({ kind: 'send', orderId: mode.order.id, content, resend: false }, true)
    else run({ kind: 'create', conversationId, content, send: true }, true)
  }

  const requestClose = () => {
    if (busy) return
    if (dirty) setConfirmClose(true)
    else onClose()
  }

  const title =
    mode.kind === 'resend'
      ? `Cập nhật đơn ${mode.order.orderCode}`
      : mode.kind === 'edit'
        ? `Chỉnh sửa đơn ${mode.order.orderCode}`
        : mode.kind === 'again'
          ? `Tạo lại đơn từ đơn ${mode.from.orderCode}`
          : 'Tạo đơn'
  const subtitle =
    mode.kind === 'resend'
      ? 'Gửi bản cập nhật sẽ đặt lại hạn đặt cọc 24 giờ và gửi một thẻ đơn mới cho khách.'
      : mode.kind === 'edit'
        ? 'Đơn đã đặt cọc: sửa được hạng mục, ngày, ghi chú. Tỷ lệ và tiền cọc đã khóa, tổng mới không nhỏ hơn tiền đã cọc.'
        : mode.kind === 'again'
          ? 'Thông tin giữ nguyên như đơn cũ, chỉ đổi mã đơn. Gửi đơn thì khách có 24 giờ mới để đặt cọc.'
          : mode.kind === 'draft'
            ? `Bản nháp ${mode.order.orderCode} · Gửi tới ${customer.name}`
            : `Gửi tới ${customer.name} trong cuộc trò chuyện này`

  return (
    <>
      <PanelDialog
        open
        size="xl"
        onRequestClose={requestClose}
        title={title}
        subtitle={subtitle}
        footer={
          <>
            {formError && (
              <p role="alert" className="mr-auto flex max-w-[60%] flex-wrap items-center gap-1.5 text-[13px] text-destructive max-sm:max-w-full max-sm:basis-full">
                <AlertCircle className="size-[15px] flex-none" />
                {formError}
                {noWedding && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-1 flex-none rounded-pill border-line-strong text-ink"
                    disabled={reminder.reminded || reminder.isPending}
                    onClick={reminder.remind}
                  >
                    <BellRing />
                    {reminder.reminded ? 'Đã nhắc khách' : 'Nhắc khách'}
                  </Button>
                )}
              </p>
            )}
            <Button type="button" variant="ghost" onClick={requestClose} disabled={busy}>
              Hủy
            </Button>
            {canDraft && (
              <Button type="button" variant="outline" className="border-line-strong" onClick={saveDraft} disabled={busy}>
                Lưu nháp
              </Button>
            )}
            <Button type="button" onClick={submit} disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Đang lưu…
                </>
              ) : mode.kind === 'edit' ? (
                'Lưu chỉnh sửa'
              ) : mode.kind === 'resend' ? (
                'Cập nhật đơn'
              ) : (
                'Gửi đơn'
              )}
            </Button>
          </>
        }
      >
        {request && (
          <div className="mb-4 rounded-md border border-warn/35 bg-warn-soft px-3.5 py-2.5 text-ink">
            <button type="button" onClick={() => setShowRequest((s) => !s)} aria-expanded={showRequest} className="flex w-full items-center gap-2 text-left text-warn">
              <MessageSquare className="size-4" />
              <strong className="font-semibold">Khách yêu cầu chỉnh sửa</strong>
              <span className="text-[12.5px] text-muted-foreground">{formatDay(request.createdDate)}</span>
              <ChevronDown className={cn('ml-auto size-4 transition-transform', !showRequest && '-rotate-90')} />
            </button>
            {showRequest && (
              <div className="mt-2 text-sm leading-relaxed">
                {request.changes.length > 0 && <p className="font-medium">{request.changes.map((c) => CHANGE_LABEL[c]).join(' · ')}</p>}
                {request.requestNote && <p>{request.requestNote}</p>}
              </div>
            )}
          </div>
        )}

        <fieldset disabled={busy} className="min-w-0">
          {locked && (
            <Section title="Nội dung thay đổi" hint="Khách sẽ thấy nội dung này trên đơn">
              <textarea
                rows={2}
                aria-label="Nội dung thay đổi (khách sẽ thấy)"
                aria-invalid={errors.changeNote ? true : undefined}
                className={cn(controlClass, 'h-auto py-2 leading-relaxed')}
                placeholder="VD: Tăng từ 20 lên 22 bàn theo yêu cầu của khách."
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
              {errors.changeNote && (
                <span role="alert" data-field-error className="mt-1 block text-xs text-destructive">
                  {errors.changeNote}
                </span>
              )}
            </Section>
          )}
          <Section title="Thông tin chung" hint={`Gắn với cuộc trò chuyện của ${customer.name} · sửa trên đơn không đổi tài khoản khách`}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
              <Field label="Tên khách hàng *" error={errors.customerName}>
                <Input
                  className={controlClass}
                  placeholder="VD: Minh Anh & Quốc Huy"
                  disabled={locked}
                  aria-invalid={errors.customerName ? true : undefined}
                  value={values.customerName}
                  onChange={(e) => set({ customerName: e.target.value })}
                />
              </Field>
              <Field label="Số điện thoại *" error={errors.customerPhone}>
                <Input
                  className={controlClass}
                  type="tel"
                  placeholder="09xx xxx xxx"
                  disabled={locked}
                  aria-invalid={errors.customerPhone ? true : undefined}
                  value={values.customerPhone}
                  onChange={(e) => set({ customerPhone: e.target.value })}
                />
              </Field>
              <Field
                label="Ngày diễn ra sự kiện *"
                error={errors.eventDate}
                hint={
                  weddingDate || advice.length ? (
                    <>
                      {weddingDate && <span className="block">Ngày cưới của khách: {formatDate(weddingDate)}</span>}
                      {advice.map((a) => (
                        <span key={a} className="mt-1 block text-gold-ink">
                          {a}
                        </span>
                      ))}
                    </>
                  ) : undefined
                }
              >
                <Input
                  className={controlClass}
                  type="date"
                  max={weddingDate && !locked ? weddingDate : undefined}
                  aria-invalid={errors.eventDate ? true : undefined}
                  value={values.eventDate}
                  onChange={(e) => set({ eventDate: e.target.value })}
                />
              </Field>
              <Field label="Ghi chú gửi khách" hint="Khách nhìn thấy ghi chú này trên đơn." full>
                <textarea
                  rows={2}
                  className={cn(controlClass, 'h-auto py-2 leading-relaxed')}
                  placeholder="VD: Giữ sảnh tầng 2, thực đơn Menu A theo bảng đính kèm."
                  value={values.note ?? ''}
                  onChange={(e) => set({ note: e.target.value || null })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Báo giá chi tiết">
            <OrderItemsEditor items={values.items} packages={quickFill} errors={errors} onChange={(next) => set({ items: next })} />
          </Section>

          <Section title="Đặt cọc và thanh toán" hint="Chỉ khoản cọc đi qua hệ thống (VNPay). Phần còn lại khách trả tiền mặt trực tiếp cho bạn.">
            <ScheduleTable
              percent={values.depositPercent}
              onPercent={(depositPercent) => set({ depositPercent })}
              error={errors.depositPercent}
              depositError={errors.deposit}
              deposit={deposit}
              rest={Math.max(0, total - deposit)}
              locked={locked}
              paidDate={locked ? (order!.payment?.paidDate ?? null) : null}
              eventDate={values.eventDate}
              disabled={busy}
            />
          </Section>
        </fieldset>
      </PanelDialog>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={mode.kind === 'edit' ? 'Chỉnh sửa đơn?' : mode.kind === 'resend' ? 'Cập nhật đơn?' : 'Gửi đơn?'}
        confirmLabel={mode.kind === 'edit' ? 'Lưu chỉnh sửa' : mode.kind === 'resend' ? 'Cập nhật đơn' : 'Gửi đơn'}
        onConfirm={doSend}
      >
        <p>
          {mode.kind === 'edit'
            ? 'Lưu chỉnh sửa cho khách? Tiền cọc đã khóa, tổng mới không thấp hơn tiền cọc.'
            : mode.kind === 'resend'
              ? 'Gửi bản cập nhật cho khách? Hạn cọc được đặt lại 24 giờ.'
              : 'Gửi đơn cho khách? Khách có 24 giờ để đặt cọc.'}
        </p>
      </ConfirmDialog>

      <PanelDialog
        open={confirmClose}
        size="md"
        onRequestClose={() => setConfirmClose(false)}
        title="Đóng khi chưa lưu?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              variant="outline"
              className="border-line-strong text-warn"
              onClick={() => {
                setConfirmClose(false)
                onClose()
              }}
            >
              Bỏ thay đổi
            </Button>
            {canDraft && (
              <Button
                onClick={() => {
                  setConfirmClose(false)
                  saveDraft()
                }}
              >
                Lưu nháp
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm leading-relaxed">
          {canDraft ? 'Đơn đang soạn chưa được lưu.' : 'Các thay đổi chưa được gửi. Đơn hiện tại giữ nguyên.'}
        </p>
      </PanelDialog>

      <UnsavedChangesGuard when={dirty && !busy} />
    </>
  )
}
