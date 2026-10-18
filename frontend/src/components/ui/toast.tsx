import { useSyncExternalStore } from 'react'

/*
 * Thông báo ngắn ở giữa đáy màn hình, theo .toast trong prototype.
 * Gọi toast('Đã lưu') ở bất cứ đâu; <Toaster /> đặt một lần trong App.
 */
let current: { id: number; message: string } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(message: string, duration = 2600) {
  current = { id: Date.now(), message }
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
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4">
      {item && (
        <div
          key={item.id}
          className="max-w-full rounded-md bg-ink px-[18px] py-2.5 text-sm text-bg animate-in fade-in-0 slide-in-from-bottom-2"
        >
          {item.message}
        </div>
      )}
    </div>
  )
}
