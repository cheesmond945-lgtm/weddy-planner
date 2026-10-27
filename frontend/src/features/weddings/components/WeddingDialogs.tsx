import { ArrowRight, CalendarDays } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { Dialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { compareStore } from '@/features/compare/store'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import { useSaveWedding, useWedding } from '../hooks'
import { WeddingDialogContent } from './LetterDialog'
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
      <WeddingDialogContent
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
      </WeddingDialogContent>
    </Dialog>
  )
}

/** Hộp "Chỉnh sửa thông tin đám cưới" (openWedEdit trong prototype). */
export function WeddingEditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: wedding } = useWedding()
  const save = useSaveWedding()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WeddingDialogContent title="Chỉnh sửa thông tin đám cưới" description="Khi đổi ngày tổ chức, các mốc trong timeline tự tính lại theo tỷ lệ thời gian.">
        {open && wedding && (
          <WeddingForm
            initial={wedding}
            submitLabel="Lưu thay đổi"
            pending={save.isPending}
            error={save.error?.message}
            onSubmit={(input) =>
              save.mutate(input, {
                onSuccess: () => {
                  onOpenChange(false)
                  toast('Đã lưu thay đổi')
                },
              })
            }
            secondaryAction={
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
            }
          />
        )}
      </WeddingDialogContent>
    </Dialog>
  )
}
