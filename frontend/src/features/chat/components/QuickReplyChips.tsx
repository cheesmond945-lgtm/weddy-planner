import { cn } from '@/lib/utils'
import type { QuickReply } from '../quickReplies'

/** Hàng câu soạn sẵn trên ô nhập (khung chat nổi và trang Tin nhắn): bấm là điền vào ô nhập, không tự gửi. */
export function QuickReplyChips({ chips, onPick, className }: { chips: QuickReply[]; onPick: (text: string) => void; className?: string }) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c.text)}
          className="shrink-0 rounded-pill border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-gold-700 hover:text-gold-700"
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
