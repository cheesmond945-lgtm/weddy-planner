import { ArrowRight, CalendarDays } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { catalogApi } from '@/api/catalog'
import { weddingsApi } from '@/api/weddings'
import { Dialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { compareStore } from '@/features/compare/store'
import { formatDate } from '@/lib/date'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import type { DateChangePreview, WeddingInput } from '@/types/wedding'
import { useSaveWedding, useWedding } from '../hooks'
import { LetterDialogContent } from '@/components/LetterDialog'
import { usePlanActions } from '../planActions'
import { DateChangePreviewDialog } from './DateChangePreviewDialog'
import { WeddingForm } from './WeddingForm'

// ---- Hộp thiết lập lần đầu (mở sau khi đăng nhập mà chưa có thông tin đám cưới) ----

let setupState: { open: boolean; then: (() => void) | null; preview?: boolean } = { open: false, then: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Mở hộp thiết lập; `then` chạy sau khi lưu xong (việc người dùng đang định làm trước khi đăng nhập). */
export function openWeddingSetup(then: (() => void) | null) {
  setupState = { open: true, then }
  emit()
}

/** Chỉ dùng khi dev (mở bằng /?setup-wedding): xem hộp thiết lập kể cả khi đã có đám cưới, bấm Esc để đóng. */
export function previewWeddingSetup() {
  setupState = { open: true, then: null, preview: true }
  emit()
}

const closeSetup = () => {
  setupState = { open: false, then: null }
  emit()
}

/** Hộp "Thiết lập thông tin đám cưới" không đóng được, như authDone trong prototype. Đặt một lần trong CoupleLayout. */
export function WeddingSetupDialog() {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => setupState,
  )
  const save = useSaveWedding()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <Dialog open={state.open && user?.role === 'COUPLE'}>
      <LetterDialogContent
        title="Thiết lập thông tin đám cưới"
        description="Nhập thông tin để tạo timeline khung"
        onEscapeKeyDown={(e) => (state.preview ? closeSetup() : e.preventDefault())}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {state.open && (
          <WeddingForm
            initial={null}
            submitLabel={
              <>
                <CalendarDays aria-hidden className="size-[18px]" />
                Tạo timeline khung
                <ArrowRight aria-hidden className="size-[18px]" />
              </>
            }
            pending={save.isPending}
            error={save.error?.message}
            onSubmit={(input) =>
              save.mutate(input, {
                onSuccess: () => {
                  const then = state.then
                  closeSetup()
                  toast('Đã tạo timeline khung')
                  if (then) then()
                  else navigate(paths.plan)
                },
              })
            }
            secondaryAction={
              <button
                type="button"
                className="mr-auto text-sm font-medium text-gold-700 underline underline-offset-[3px]"
                onClick={() => {
                  closeSetup()
                  logout()
                  compareStore.clear()
                  navigate(paths.services)
                  toast('Đã đăng xuất')
                }}
              >
                Đăng xuất
              </button>
            }
          />
        )}
      </LetterDialogContent>
    </Dialog>
  )
}

/** Hộp "Chỉnh sửa thông tin đám cưới" (openWedEdit trong prototype). */
export function WeddingEditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: wedding } = useWedding()
  const save = useSaveWedding()
  const { openChat } = usePlanActions()
  // Đổi ngày cưới: xem trước (hạn cũ → mới) rồi xác nhận mới lưu; đổi thông tin khác thì lưu thẳng
  const [pending, setPending] = useState<{ input: WeddingInput; preview: DateChangePreview } | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const finish = () => {
    setPending(null)
    onOpenChange(false)
    toast('Đã lưu thay đổi')
  }
  const submit = (input: WeddingInput) => {
    if (!wedding || input.date === wedding.date) return save.mutate(input, { onSuccess: finish })
    setChecking(true)
    setCheckError(null)
    weddingsApi
      .previewDateChange(input.date)
      .then((preview) => setPending({ input, preview }))
      .catch((e: Error) => setCheckError(e.message))
      .finally(() => setChecking(false))
  }
  const messageVendor = (serviceId: string, orderCode: string, eventDate: string) => {
    const newDate = pending?.input.date
    setPending(null)
    onOpenChange(false)
    catalogApi.getService(serviceId).then(
      (service) => openChat(service, { draft: `Chào shop, mình vừa đổi ngày cưới${newDate ? ` sang ${formatDate(newDate)}` : ''}. Mình muốn cập nhật ngày thực hiện đơn ${orderCode} (hiện là ${formatDate(eventDate)}), bên mình trao đổi được không ạ?` }),
      () => toast('Không mở được khung chat với nhà cung cấp'),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LetterDialogContent title="Chỉnh sửa thông tin đám cưới" description="Khi đổi ngày tổ chức, bạn sẽ được xem trước hạn mới của các việc chưa xong rồi mới xác nhận.">
        {open && wedding && (
          <WeddingForm
            initial={wedding}
            submitLabel="Lưu thay đổi"
            pending={save.isPending || checking}
            error={checkError ?? save.error?.message}
            onSubmit={submit}
            secondaryAction={
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
            }
          />
        )}
        <DateChangePreviewDialog
          newDate={pending?.input.date ?? null}
          preview={pending?.preview ?? null}
          pending={save.isPending}
          error={save.error?.message}
          onCancel={() => setPending(null)}
          onConfirm={() => pending && save.mutate(pending.input, { onSuccess: finish })}
          onMessageVendor={messageVendor}
        />
      </LetterDialogContent>
    </Dialog>
  )
}
