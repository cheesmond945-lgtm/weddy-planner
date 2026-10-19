import { AlertCircle, ChevronDown, LoaderCircle, MessageSquare } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isVenue } from '@/features/vendorPackages/constants'
import { usePackages } from '@/features/vendorPackages/hooks'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { UnsavedChangesGuard } from '@/features/vendors/components/UnsavedChangesGuard'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { OrderContent, ServiceOrder } from '@/types/serviceOrder'
import { cleanContent, currentVersion, diffContent, emptyContent, rebalance, totalOf } from '../calc'
import { useSaveOrder } from '../hooks'
import { validateOrder, type OrderErrors } from '../validation'
import { InstallmentsEditor } from './InstallmentsEditor'
import { OrderLinesEditor, type QuickFillPackage } from './OrderLinesEditor'
import { PanelDialog } from './PanelDialog'

interface OrderFormDialogProps {
  conversationId: string
  customer: { name: string; phone: string }
  /** Không có: thêm đơn mới. Có: mở lại bản nháp, hoặc sửa đơn đã gửi */
  order?: ServiceOrder
  onClose: () => void
  /** Gửi thành công (để cuộn tới thẻ đơn) */
  onSent?: (order: ServiceOrder) => void
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

/**
 * Form đơn trong khung chat (OrderModal trong prototype NCC).
 * Lưu nháp: chỉ NCC thấy, không kiểm tra. Gửi: kiểm tra đủ, gửi v1; đơn đã gửi thì thành phiên bản mới (v2, v3…).
 */
export function OrderFormDialog({ conversationId, customer, order, onClose, onSent }: OrderFormDialogProps) {
  const save = useSaveOrder()
  const { data: packages } = usePackages()
  const sent = currentVersion(order ?? { versions: [] })
  // Lấy giá trị lúc mở form: bản nháp (nếu có) hoặc phiên bản đang gửi; gửi lại dựa trên phiên bản lúc mở
  const [initial] = useState<OrderContent>(() =>
    structuredClone(order ? (order.draft && (order.draft.kind === 'EDIT' || !sent) ? order.draft.content : sent!.content) : emptyContent(customer)),
  )
  const [baseVersion] = useState(() => sent?.version ?? null)
  const [content, setContent] = useState(initial)
  const [checked, setChecked] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [showRequest, setShowRequest] = useState(true)

  const busy = save.isPending
  const dirty = JSON.stringify(content) !== JSON.stringify(initial)
  const total = totalOf(content.lines)
  const errors: OrderErrors = checked ? validateOrder(content) : {}

  const quickFill: QuickFillPackage[] = (packages ?? [])
    .filter((p) => p.status === 'PUBLISHED')
    .map((p) => ({ id: p.id, name: p.name, price: p.price, unit: isVenue(p.category) ? 'Bàn' : 'Gói' }))

  const set = (patch: Partial<OrderContent>) => setContent((c) => ({ ...c, ...patch }))

  function persist(send: boolean) {
    setFormError('')
    if (send) {
      setChecked(true)
      const found = validateOrder(content)
      if (sent && !Object.keys(found).length && !diffContent(sent.content, cleanContent(content)).length) {
        setFormError('Chưa có thay đổi nào so với phiên bản đang gửi.')
        return
      }
      if (Object.keys(found).length) {
        requestAnimationFrame(() => document.querySelector('[role=dialog] [data-field-error], [role=dialog] [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
        return
      }
    }
    save.mutate(
      order ? { orderId: order.id, conversationId, content, send, baseVersion } : { orderId: null, conversationId, content, send, baseVersion: null },
      {
        onSuccess: (o) => {
          if (send) onSent?.(o)
          onClose()
        },
        onError: (e) => setFormError(e.message || 'Không gửi được đơn. Dữ liệu vẫn được giữ, vui lòng thử lại.'),
      },
    )
  }

  const requestClose = () => {
    if (busy) return
    if (dirty) setConfirmClose(true)
    else onClose()
  }

  const title = sent ? `Chỉnh sửa đơn hàng ${order!.code}` : 'Thêm đơn hàng'
  const subtitle = sent
    ? `Đang soạn v${sent.version + 1} · v${sent.version} vẫn giữ nguyên cho tới khi gửi lại`
    : order
      ? `Bản nháp ${order.code} · Gửi tới ${customer.name}`
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
              <p role="alert" className="mr-auto flex max-w-[56%] items-center gap-1.5 text-[13px] text-destructive max-sm:max-w-full max-sm:basis-full">
                <AlertCircle className="size-[15px] flex-none" />
                {formError}
              </p>
            )}
            <Button type="button" variant="ghost" onClick={requestClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="button" variant="outline" className="border-line-strong" onClick={() => persist(false)} disabled={busy}>
              Lưu nháp
            </Button>
            <Button type="button" onClick={() => persist(true)} disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Đang gửi…
                </>
              ) : sent ? (
                'Gửi lại cho khách'
              ) : (
                'Gửi đơn cho khách hàng'
              )}
            </Button>
          </>
        }
      >
        {sent && order?.revisionRequest && (
          <div className="mb-4 rounded-md border border-warn/35 bg-warn-soft px-3.5 py-2.5 text-ink">
            <button type="button" onClick={() => setShowRequest((s) => !s)} aria-expanded={showRequest} className="flex w-full items-center gap-2 text-left text-warn">
              <MessageSquare className="size-4" />
              <strong className="font-semibold">Yêu cầu của khách · v{order.revisionRequest.version}</strong>
              <span className="text-[12.5px] text-muted-foreground">{formatMessageTime(order.revisionRequest.requestedAt)}</span>
              <ChevronDown className={cn('ml-auto size-4 transition-transform', !showRequest && '-rotate-90')} />
            </button>
            {showRequest && <p className="mt-2 text-sm leading-relaxed">{order.revisionRequest.note}</p>}
          </div>
        )}

        <fieldset disabled={busy} className="min-w-0">
          <Section title="Thông tin chung" hint={`Gắn với cuộc trò chuyện của ${customer.name} · sửa trên đơn không đổi tài khoản khách`}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
              <Field label="Tên khách hàng *" error={errors.customerName}>
                <Input
                  className={controlClass}
                  placeholder="VD: Minh Anh & Quốc Huy"
                  aria-invalid={errors.customerName ? true : undefined}
                  value={content.customerName}
                  onChange={(e) => set({ customerName: e.target.value })}
                />
              </Field>
              <Field label="Số điện thoại *" error={errors.customerPhone}>
                <Input
                  className={controlClass}
                  type="tel"
                  placeholder="09xx xxx xxx"
                  aria-invalid={errors.customerPhone ? true : undefined}
                  value={content.customerPhone}
                  onChange={(e) => set({ customerPhone: e.target.value })}
                />
              </Field>
              <Field label="Ngày diễn ra sự kiện *" error={errors.eventDate}>
                <Input
                  className={controlClass}
                  type="date"
                  aria-invalid={errors.eventDate ? true : undefined}
                  value={content.eventDate}
                  onChange={(e) => set({ eventDate: e.target.value })}
                />
              </Field>
              <Field label="Ghi chú gửi khách" hint="Khách nhìn thấy ghi chú này trên đơn." full>
                <textarea
                  rows={2}
                  className={cn(controlClass, 'h-auto py-2 leading-relaxed')}
                  placeholder="VD: Giữ sảnh tầng 2, thực đơn Menu A theo bảng đính kèm."
                  value={content.note ?? ''}
                  onChange={(e) => set({ note: e.target.value || null })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Báo giá chi tiết">
            <OrderLinesEditor
              lines={content.lines}
              packages={quickFill}
              errors={errors}
              onChange={(lines) => setContent((c) => ({ ...c, lines, installments: rebalance(c.installments, totalOf(lines)) }))}
            />
          </Section>

          <Section title="Các đợt thanh toán" hint="Lịch yêu cầu thanh toán, chưa phải tiền đã thu. Đợt 1 là đặt cọc, khách trả qua VNPay.">
            <InstallmentsEditor installments={content.installments} total={total} errors={errors} showAllocation={checked} onChange={(installments) => set({ installments })} />
          </Section>
        </fieldset>
      </PanelDialog>

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
            <Button
              onClick={() => {
                setConfirmClose(false)
                persist(false)
              }}
            >
              Lưu nháp
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">
          {sent ? `Bản đang sửa chưa được lưu. Phiên bản v${sent.version} đã gửi và trạng thái hiện tại sẽ giữ nguyên.` : 'Đơn đang soạn chưa được lưu.'}
        </p>
      </PanelDialog>

      <UnsavedChangesGuard when={dirty && !busy} />
    </>
  )
}
