import { MessageSquare, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'

/*
 * Toast tin nhắn mới ở góc dưới bên phải cổng NCC: "{tên khách}: {trích đoạn}", bấm để mở hội thoại.
 * Gọi showMessageToast(...) ở bất cứ đâu; <MessageToaster /> đặt một lần trong VendorLayout. Tách khỏi toast() chung
 * (thông báo ngắn giữa đáy màn hình) để không đổi hành vi các trang khác.
 */
interface MessageToastItem {
  id: number
  title: string
  text: string
  href: string
}

const MAX_VISIBLE = 3
let items: MessageToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function dismiss(id: number) {
  items = items.filter((i) => i.id !== id)
  emit()
}

export function showMessageToast(toast: Omit<MessageToastItem, 'id'>, duration = 8000) {
  const id = ++seq
  items = [...items, { ...toast, id }].slice(-MAX_VISIBLE)
  emit()
  setTimeout(() => dismiss(id), duration)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function MessageToaster() {
  const list = useSyncExternalStore(subscribe, () => items)
  const navigate = useNavigate()
  if (!list.length) return null
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(340px,calc(100vw-32px))] flex-col gap-2 max-sm:right-4 max-sm:left-4 max-sm:w-auto">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto relative rounded-lg border border-line bg-surface shadow-card animate-in fade-in-0 slide-in-from-bottom-2">
          <button
            type="button"
            onClick={() => {
              dismiss(t.id)
              navigate(t.href)
            }}
            className="flex w-full items-start gap-3 rounded-lg py-3 pr-9 pl-3.5 text-left hover:bg-accent-soft"
          >
            <span aria-hidden className="mt-0.5 grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-gold-ink">
              <MessageSquare className="size-3.5" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[13px] font-semibold text-ink">{t.title}</strong>
              <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{t.text}</span>
            </span>
          </button>
          <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(t.id)} className="absolute top-2 right-2 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-bg hover:text-ink">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
