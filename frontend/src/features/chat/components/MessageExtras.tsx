import { CornerUpLeft, Download, MoreHorizontal, SmilePlus, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { MessageAttachment, MessageReaction, MessageReplyRef, MessageSender } from '@/types/chat'
import { myReaction, nextReaction, REACTIONS } from '../reactions'

/** Tên hiện cho người gửi trong đoạn trích / thanh "Đang trả lời" (theo phía đang xem) */
export type NameOf = (sender: MessageSender) => string

/** Phần tin mà khung tin cần (dùng chung cho tin phía cặp đôi và NCC) */
interface ShellMessage {
  id: string
  sender: MessageSender
  content: string
  replyTo?: MessageReplyRef | null
  reactions?: MessageReaction[]
  isAuto?: boolean
  recalled?: boolean
}

/**
 * Lưu ảnh về máy. Link ảnh là link ký của Storage (khác tên miền) nên thuộc tính download của thẻ a bị bỏ qua: tải về thành Blob rồi lưu.
 * Tải lỗi thì mở ảnh ở tab mới để người dùng tự lưu.
 */
async function saveImages(images: { url: string; name: string }[]) {
  for (const img of images) {
    try {
      const res = await fetch(img.url)
      if (!res.ok) throw new Error(String(res.status))
      const href = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = href
      a.download = img.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch {
      window.open(img.url, '_blank', 'noopener')
    }
  }
}

/** Ảnh của tin (hoặc các tin của album) cho mục "Lưu ảnh" */
export const imagesOf = (messages: { attachment?: MessageAttachment | null }[]) =>
  messages.flatMap((x) => (x.attachment?.mime.startsWith('image/') ? [{ url: x.attachment.url, name: x.attachment.name }] : []))

/** Cuộn tới tin gốc của đoạn trích và làm nổi một chút */
function jumpTo(id: string) {
  const el = document.getElementById(`msg-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('animate-pulse')
  window.setTimeout(() => el.classList.remove('animate-pulse'), 1200)
}

/**
 * Khung bao một tin chữ (như Messenger): đoạn trích tin được trả lời ở trên, nút Thả cảm xúc / Trả lời cạnh tin (hiện khi rê chuột,
 * màn hình cảm ứng thì luôn hiện mờ), dải cảm xúc dưới tin, nhãn "Trả lời tự động" với tin AI.
 * `width`: giới hạn bề ngang của hàng tin (thay cho max-width trên chính khung tin).
 */
export function MessageShell({
  message: m,
  mine,
  nameOf,
  width,
  onReply,
  onReact,
  onRecall,
  images,
  children,
}: {
  message: ShellMessage
  mine: boolean
  nameOf: NameOf
  width?: string
  onReply: (m: ShellMessage) => void
  onReact: (messageId: string, emoji: string | null) => void
  /** Thu hồi tin của chính mình (chỉ hiện trong menu "⋯" với tin của mình) */
  onRecall?: (messageId: string) => void
  /** Ảnh của tin (tin ảnh hoặc album): menu "⋯" có "Lưu ảnh" */
  images?: { url: string | null; name: string }[]
  children: ReactNode
}) {
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState(false)
  const [confirmRecall, setConfirmRecall] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  // Bấm ra ngoài thì đóng bảng cảm xúc / menu "⋯"
  useEffect(() => {
    if (!picking && !menu) return
    const close = (e: MouseEvent) => {
      if (pickerRef.current?.contains(e.target as Node)) return
      setPicking(false)
      setMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [picking, menu])

  // Tin đã thu hồi: chỉ còn một dòng viền nét đứt, không còn nút thả cảm xúc / trả lời
  if (m.recalled) {
    return (
      <div id={`msg-${m.id}`} className={cn('flex w-full flex-col', mine ? 'items-end' : 'items-start')}>
        <p className="rounded-[20px] border border-dashed border-line-strong px-[15px] py-[9px] text-[13px] text-muted-foreground italic">
          {mine ? 'Bạn' : nameOf(m.sender)} đã thu hồi một tin nhắn
        </p>
      </div>
    )
  }

  const mineEmoji = myReaction(m.reactions)
  const reactions = m.reactions ?? []
  const total = reactions.reduce((s, r) => s + r.count, 0)
  const actionBtn = 'grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-bg hover:text-ink'
  const menuItem = 'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] hover:bg-bg'
  // Menu "⋯": Lưu ảnh (tin ảnh / album, của ai cũng được), Thu hồi (chỉ tin của mình)
  const canRecall = mine && !!onRecall
  const saveable = (images ?? []).filter((i): i is { url: string; name: string } => !!i.url)

  return (
    <div id={`msg-${m.id}`} className={cn('group/msg flex w-full flex-col', mine ? 'items-end' : 'items-start')}>
      {m.replyTo && (
        <button
          type="button"
          onClick={() => jumpTo(m.replyTo!.id)}
          className={cn('mb-[-8px] max-w-[min(320px,80%)] rounded-[14px] bg-line-soft px-3 pt-1.5 pb-3 text-left text-[12px] text-muted-foreground hover:opacity-90', mine ? 'mr-1' : 'ml-1')}
        >
          <span className="flex items-center gap-1 font-medium">
            <CornerUpLeft className="size-3" aria-hidden />
            Trả lời {nameOf(m.replyTo.sender)}
          </span>
          <span className="line-clamp-2 [overflow-wrap:anywhere]">{m.replyTo.content}</span>
        </button>
      )}
      <div className={cn('relative flex min-w-0 items-center gap-1', mine && 'flex-row-reverse', width)}>
        <div className="min-w-0">{children}</div>
        <div
          ref={pickerRef}
          className={cn(
            'relative flex flex-none items-center opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-60',
            mine && 'flex-row-reverse',
            (picking || menu) && 'opacity-100',
          )}
        >
          <button
            type="button"
            aria-label="Thả cảm xúc"
            title="Thả cảm xúc"
            className={actionBtn}
            onClick={() => {
              setPicking((v) => !v)
              setMenu(false)
            }}
          >
            <SmilePlus className="size-4" />
          </button>
          <button type="button" aria-label="Trả lời tin này" title="Trả lời" className={actionBtn} onClick={() => onReply(m)}>
            <CornerUpLeft className="size-4" />
          </button>
          {(canRecall || saveable.length > 0) && (
            <button
              type="button"
              aria-label="Thêm"
              title="Thêm"
              aria-haspopup="menu"
              aria-expanded={menu}
              className={actionBtn}
              onClick={() => {
                setMenu((v) => !v)
                setPicking(false)
              }}
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
          {menu && (
            <div role="menu" aria-label="Tùy chọn tin nhắn" className={cn('absolute bottom-full z-20 mb-1 min-w-[150px] rounded-[12px] border border-line bg-surface py-1 shadow-md', mine ? 'right-0' : 'left-0')}>
              {saveable.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => {
                    setMenu(false)
                    void saveImages(saveable)
                  }}
                >
                  <Download className="size-4" />
                  {saveable.length > 1 ? `Lưu ${saveable.length} ảnh` : 'Lưu ảnh'}
                </button>
              )}
              {canRecall && (
                <button
                  type="button"
                  role="menuitem"
                  className={cn(menuItem, 'text-warn')}
                  onClick={() => {
                    setMenu(false)
                    setConfirmRecall(true)
                  }}
                >
                  <Undo2 className="size-4" />
                  Thu hồi
                </button>
              )}
            </div>
          )}
          {picking && (
            <div role="menu" aria-label="Chọn cảm xúc" className={cn('absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-pill border border-line bg-surface px-1.5 py-1 shadow-md', mine ? 'right-0' : 'left-0')}>
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="menuitem"
                  aria-label={`Thả ${e}`}
                  onClick={() => {
                    onReact(m.id, nextReaction(m.reactions, e))
                    setPicking(false)
                  }}
                  className={cn('grid size-8 place-items-center rounded-full text-[18px] transition-transform hover:scale-125', mineEmoji === e && 'bg-gold-100')}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {total > 0 && (
        <button
          type="button"
          title={mineEmoji ? 'Bấm để gỡ cảm xúc của bạn' : 'Thả cảm xúc'}
          aria-label={`${total} cảm xúc: ${reactions.map((r) => `${r.emoji} ${r.count}`).join(', ')}`}
          onClick={() => (mineEmoji ? onReact(m.id, null) : setPicking(true))}
          className={cn('relative z-[1] -mt-2 flex items-center gap-0.5 rounded-pill border border-line bg-surface px-1.5 py-px text-[12px] shadow-sm', mine ? 'mr-2' : 'ml-2', mineEmoji && 'border-gold-500')}
        >
          {reactions.map((r) => (
            <span key={r.emoji}>{r.emoji}</span>
          ))}
          {total > 1 && <span className="ml-0.5 text-muted-foreground tabular-nums">{total}</span>}
        </button>
      )}
      {m.isAuto && <span className="mt-0.5 px-1 text-[11px] text-muted-foreground italic">Trả lời tự động</span>}
      {onRecall && (
        <ConfirmDialog
          open={confirmRecall}
          onOpenChange={setConfirmRecall}
          title="Thu hồi tin nhắn?"
          confirmLabel="Thu hồi"
          danger
          icon={<Undo2 />}
          onConfirm={() => onRecall(m.id)}
        >
          Tin nhắn sẽ bị thu hồi với mọi người trong cuộc trò chuyện. Cả hai bên chỉ còn thấy dòng “đã thu hồi một tin nhắn”.
        </ConfirmDialog>
      )}
    </div>
  )
}

/** Thanh "Đang trả lời …" phía trên ô nhập, có nút hủy */
export function ReplyBar({ reply, nameOf, onCancel }: { reply: { sender: MessageSender; content: string }; nameOf: NameOf; onCancel: () => void }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-primary bg-bg px-3 py-1.5 text-[12.5px]">
      <div className="min-w-0 flex-1">
        <b className="font-semibold">Đang trả lời {nameOf(reply.sender)}</b>
        <p className="truncate text-muted-foreground">{reply.content}</p>
      </div>
      <button type="button" aria-label="Hủy trả lời" onClick={onCancel} className="grid size-6 flex-none place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-ink">
        <X className="size-3.5" />
      </button>
    </div>
  )
}
