import { useSyncExternalStore } from 'react'

/*
 * Thông báo ngắn ở góc phải dưới màn hình, theo .toast trong prototype.
 * Gọi toast('Đã lưu') ở bất cứ đâu; <Toaster /> đặt một lần trong App.
 * Có nút kèm theo (ví dụ "Hoàn tác"): toast('Đã xóa việc', { action: { label: 'Hoàn tác', onClick } }).
 */
interface ToastAction {
  label: string
  onClick: () => void
}

let current: { id: number; message: string; action?: ToastAction } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** action: nút ngay trong thông báo (ví dụ "Hoàn tác"); bấm xong thông báo tự đóng. Gọi được cả toast(msg, { action }) lẫn toast(msg, duration, action). */
export function toast(message: string, options: number | { duration?: number; action?: ToastAction } = {}, actionArg?: ToastAction) {
  const { duration = 2600, action } =
    typeof options === 'number' ? { duration: options, action: actionArg } : { duration: options.action ? 6000 : undefined, ...options }
  current = { id: Date.now(), message, action }
  emit()
  clearTimeout(timer)
  timer = setTimeout(() => {
    current = null
    emit()
  }, duration)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function Toaster() {
  const item = useSyncExternalStore(subscribe, () => current)
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-end px-5">
      {item && (
        <div
          key={item.id}
          className="flex max-w-full items-center gap-3.5 rounded-md bg-ink px-[18px] py-2.5 text-sm text-bg animate-in fade-in-0 slide-in-from-bottom-2"
        >
          {item.message}
          {item.action && (
            <button
              type="button"
              className="pointer-events-auto font-semibold text-primary underline underline-offset-[3px]"
              onClick={() => {
                item.action!.onClick()
                current = null
                emit()
              }}
            >
              {item.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
