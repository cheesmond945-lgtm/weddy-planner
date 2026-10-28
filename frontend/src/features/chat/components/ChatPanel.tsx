import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, FileText, Loader2, RotateCw, SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { chatApi } from '@/api/chat'
import { planningKeys } from '@/features/weddings/hooks'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import type { Message } from '@/types/chat'
import { coupleWording } from '../wording'
import { chatPanel, isWithinHours, useChatPanel, type ChatPanelState } from '../chatPanel'
import { useMarkReadOnView, useMessages } from '../hooks'

/** Ô nhập tự giãn tối đa 4 dòng (cao mỗi dòng 22px + đệm trên dưới 20px). */
const LINE = 22
const MAX_INPUT_HEIGHT = LINE * 4 + 20

/** Tin đang gửi / gửi lỗi, hiện ngay cuối danh sách trước khi BE trả về. */
interface PendingMessage {
  id: string
  text: string
  status: 'sending' | 'failed'
}

/**
 * Khung chat với NCC mở từ nút "Nhắn tin với NCC".
 * Máy tính: trượt từ phải, rộng 380px, cao hết màn hình. Điện thoại (< 900px): toàn màn hình, có nút quay lại.
 * Dialog của Radix lo phần giữ focus trong khung, Esc để đóng và trả focus về nút đã bấm.
 */
export function ChatPanel() {
  const panel = useChatPanel()
  return (
    <DialogPrimitive.Root open={!!panel} onOpenChange={(o) => !o && chatPanel.close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(43_38_32/0.25)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 max-[900px]:hidden" />
        <DialogPrimitive.Content
          aria-describedby="chat-panel-status"
          // Mở khung thì đưa focus vào ô nhập tin (Radix mặc định focus nút đầu tiên là nút quay lại)
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector('textarea')?.focus()
          }}
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-[380px] flex-col border-l border-line bg-surface text-ink shadow-[-12px_0_40px_rgb(60_45_20/0.12)] outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right max-[900px]:w-full max-[900px]:border-l-0"
        >
          {panel && <PanelBody key={panel.conversation.id} panel={panel} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PanelBody({ panel }: { panel: ChatPanelState }) {
  const { conversation, packageName, workingHours } = panel
  const { service } = conversation
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id
  const messagesKey = planningKeys.messages(uid, conversation.id)
  const { data: messages = [], isPending } = useMessages(conversation.id)
  useMarkReadOnView(conversation.id, messages)

  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingMessage[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const online = isWithinHours(workingHours)

  // Tin soạn sẵn chỉ dành cho lần nhắn đầu: tải xong tin cũ mà khách chưa nhắn lần nào thì mới điền, con trỏ đặt cuối câu
  const draftDone = useRef(false)
  useEffect(() => {
    if (isPending || draftDone.current) return
    draftDone.current = true
    if (!panel.draft || messages.some((m) => m.sender === 'COUPLE')) return
    setText(panel.draft)
    requestAnimationFrame(() => {
      const el = inputRef.current
      el?.setSelectionRange(el.value.length, el.value.length)
    })
  }, [isPending, messages, panel.draft])

  // Có tin mới (kể cả tin đang gửi) thì cuộn xuống cuối
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, pending.length])

  // Ô nhập giãn theo nội dung, tối đa 4 dòng rồi cuộn trong ô
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [text])

  async function deliver(item: PendingMessage) {
    setPending((list) => list.map((p) => (p.id === item.id ? { ...p, status: 'sending' } : p)))
    try {
      const msg = await chatApi.send(conversation.id, item.text)
      setPending((list) => list.filter((p) => p.id !== item.id))
      qc.setQueryData<Message[]>(messagesKey, (list = []) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]))
      void qc.invalidateQueries({ queryKey: planningKeys.conversations(uid) })
      // NCC (dữ liệu giả) thường trả lời sau khoảng 1 giây: hỏi lại sớm hơn chu kỳ thường
      setTimeout(() => void qc.invalidateQueries({ queryKey: messagesKey }), 1200)
    } catch {
      setPending((list) => list.map((p) => (p.id === item.id ? { ...p, status: 'failed' } : p)))
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const t = text.trim()
    if (!t) return
    const item: PendingMessage = { id: `tmp-${Date.now()}`, text: t, status: 'sending' }
    setPending((list) => [...list, item])
    setText('')
    void deliver(item)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter gửi, Shift+Enter xuống dòng; đang gõ dấu tiếng Việt (IME) thì Enter để bộ gõ xử lý
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const chips = [
    { label: 'Hỏi giá chốt', text: `Mình muốn hỏi giá chốt cho ${packageName ? `gói ${packageName}` : 'gói dịch vụ bên mình'} ạ.` },
    { label: 'Xem lịch trống', text: 'Cho mình hỏi bên mình còn lịch trống vào ngày cưới của mình không ạ?' },
    { label: 'Đặt lịch tham quan', text: 'Mình muốn đặt lịch qua tham quan và tư vấn trực tiếp. Bên mình có khung giờ nào phù hợp không ạ?' },
  ]
  const iconBtn = 'grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-gold-100 hover:text-ink [&_svg]:size-5'

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
        <DialogPrimitive.Close aria-label="Quay lại" className={cn(iconBtn, 'min-[901px]:hidden')}>
          <ArrowLeft strokeWidth={1.75} />
        </DialogPrimitive.Close>
        <img src={service.coverImageUrl} alt="" className="size-11 shrink-0 rounded-full border border-line bg-gold-100 object-cover" />
        <div className="min-w-0 flex-1">
          <DialogPrimitive.Title className="truncate font-serif text-lg leading-tight font-semibold">{service.name}</DialogPrimitive.Title>
          <p id="chat-panel-status" className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-2">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full', online ? 'bg-sage' : 'bg-ink-3')} />
            {online ? 'Thường trả lời trong ~1 giờ' : 'NCC sẽ trả lời sớm nhất có thể'}
          </p>
        </div>
        <Link
          to={`${paths.chat}?c=${conversation.id}`}
          onClick={() => chatPanel.close()}
          aria-label="Mở trong trang Tin nhắn"
          title="Mở trong trang Tin nhắn"
          className={iconBtn}
        >
          <ExternalLink strokeWidth={1.75} />
        </Link>
        <DialogPrimitive.Close aria-label="Đóng khung chat" title="Đóng" className={cn(iconBtn, 'max-[900px]:hidden')}>
          <X strokeWidth={1.75} />
        </DialogPrimitive.Close>
      </header>

      <div ref={listRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {isPending ? (
          <div className="grid flex-1 place-items-center text-ink-3" aria-label="Đang tải tin nhắn">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} conversationId={conversation.id} vendorName={service.name} />)
        )}
        {pending.map((p) => (
          <div key={p.id} className="flex flex-col items-end">
            <div className={cn(bubble, 'rounded-br-md bg-gold-700 text-white', p.status === 'sending' && 'opacity-70')}>{p.text}</div>
            {p.status === 'sending' ? (
              <span className="mt-1 text-xs text-ink-3">Đang gửi…</span>
            ) : (
              <span className="mt-1 flex items-center gap-2 text-xs text-destructive">
                Gửi lỗi.
                <button type="button" onClick={() => void deliver(p)} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  <RotateCw className="size-3" aria-hidden />
                  Gửi lại
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {/* Chip gợi ý: bấm là điền vào ô nhập, không tự gửi */}
        <div className="mb-2.5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                setText(c.text)
                inputRef.current?.focus()
              }}
              className="shrink-0 rounded-pill border border-line bg-bg px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-gold-700 hover:text-gold-700"
            >
              {c.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Hỏi NCC về giá, lịch trống, thực đơn..."
            aria-label={`Tin nhắn gửi ${service.name}`}
            style={{ lineHeight: `${LINE}px` }}
            className="min-w-0 flex-1 resize-none rounded-[20px] border border-line bg-bg px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-gold-700 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Gửi tin nhắn"
            title="Gửi (Enter)"
            disabled={!text.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-700 text-white transition-colors hover:bg-gold-800 disabled:opacity-50"
          >
            <SendHorizontal className="size-[18px]" strokeWidth={1.75} />
          </button>
        </form>
        <p className="mt-1.5 text-xs text-ink-3 max-[900px]:hidden">Enter để gửi, Shift + Enter để xuống dòng</p>
      </div>
    </>
  )
}

const bubble = 'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-[1.5] whitespace-pre-wrap [overflow-wrap:anywhere]'

function Bubble({ message: m, conversationId, vendorName }: { message: Message; conversationId: string; vendorName: string }) {
  const time = <span className="mt-1 text-xs text-ink-3">{formatMessageTime(m.sentDate)}</span>
  if (m.sender === 'SYSTEM') {
    return <div className="self-center rounded-pill bg-sage-soft px-3 py-1 text-center text-xs text-sage">{coupleWording(m.content, vendorName)}</div>
  }
  // Đơn dịch vụ: khung hẹp không đủ chỗ cho thẻ đơn đầy đủ, mở trang Tin nhắn để xem và xử lý
  if (m.type === 'Order') {
    return (
      <div className="flex flex-col items-start">
        <Link
          to={`${paths.chat}?c=${conversationId}`}
          onClick={() => chatPanel.close()}
          className="flex items-center gap-2.5 rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-sm hover:border-gold-700"
        >
          <FileText className="size-5 shrink-0 text-gold-700" strokeWidth={1.5} aria-hidden />
          <span>
            <b className="block font-semibold">NCC đã gửi đơn dịch vụ</b>
            <span className="text-[13px] text-gold-700 underline underline-offset-2">Xem đơn trong trang Tin nhắn</span>
          </span>
        </Link>
        {time}
      </div>
    )
  }
  const mine = m.sender === 'COUPLE'
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div className={cn(bubble, mine ? 'rounded-br-md bg-gold-700 text-white' : 'rounded-bl-md bg-gold-100 text-ink')}>{m.content}</div>
      {time}
    </div>
  )
}
