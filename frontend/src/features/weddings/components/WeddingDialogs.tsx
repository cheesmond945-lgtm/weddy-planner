import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { catalogApi } from '@/api/catalog'
import { weddingsApi } from '@/api/weddings'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { compareStore } from '@/features/compare/store'
import { formatDate } from '@/lib/date'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import type { DateChangePreview, WeddingInput } from '@/types/wedding'
import { useSaveWedding, useWedding } from '../hooks'
import { usePlanActions } from '../planActions'
import { DateChangePreviewDialog } from './DateChangePreviewDialog'
import { WeddingForm } from './WeddingForm'

// ---- Hộp thiết lập lần đầu (mở sau khi đăng nhập mà chưa có thông tin đám cưới) ----

let setupState: { open: boolean; then: (() => void) | null } = { open: false, then: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Mở hộp thiết lập; `then` chạy sau khi lưu xong (việc người dùng đang định làm trước khi đăng nhập). */
export function openWeddingSetup(then: (() => void) | null) {
  setupState = { open: true, then }
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
      <DialogContent
        showCloseButton={false}
        className="max-w-[780px]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Thiết lập thông tin đám cưới</DialogTitle>
          <DialogDescription className="sr-only">Nhập thông tin để tạo timeline khung</DialogDescription>
        </DialogHeader>
        {state.open && (
          <WeddingForm
            initial={null}
            submitLabel="Tạo timeline khung"
            pending={save.isPending}
            error={save.error?.message}
            onSubmit={(input) =>
              save.mutate(input, {
                onSuccess: () => {
                  const then = state.then
                  closeSetup()
                  toast('Đã tạo timeline khung')
                  if (then) then()
                  else navigate(paths.timeline)
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
      </DialogContent>
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
      <DialogContent className="max-w-[780px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thông tin đám cưới</DialogTitle>
          <DialogDescription>Khi đổi ngày tổ chức, bạn sẽ được xem trước hạn mới của các việc chưa xong rồi mới xác nhận.</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
