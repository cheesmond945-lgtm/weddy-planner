/*
 * Cảm xúc trên tin nhắn (như Messenger): mỗi người một cảm xúc cho mỗi tin, thả emoji khác thì thay, thả lại đúng emoji đang có thì gỡ.
 * Hàm thuần dùng cho cập nhật lạc quan ở cả phía cặp đôi và NCC (có test).
 */
import type { MessageReaction } from '../../types/chat.ts'

/** Cùng thứ tự với backend (chat.mappers.ts REACTIONS) */
export const REACTIONS = ['❤️', '😆', '😮', '😢', '😠', '👍'] as const

/** Emoji người xem đang thả ở tin này, hoặc null */
export const myReaction = (reactions: readonly MessageReaction[] | undefined) => reactions?.find((r) => r.mine)?.emoji ?? null

/** Emoji gửi lên khi người xem bấm `emoji`: bấm lại đúng emoji đang thả là gỡ (null) */
export const nextReaction = (reactions: readonly MessageReaction[] | undefined, emoji: string) => (myReaction(reactions) === emoji ? null : emoji)

/** Danh sách cảm xúc sau khi người xem đổi cảm xúc của mình thành `emoji` (null: gỡ). Giữ thứ tự REACTIONS, bỏ emoji không còn ai thả. */
export function withMyReaction(reactions: readonly MessageReaction[] | undefined, emoji: string | null): MessageReaction[] {
  const counts = new Map<string, { count: number; mine: boolean }>()
  for (const r of reactions ?? []) counts.set(r.emoji, { count: r.mine ? r.count - 1 : r.count, mine: false })
  if (emoji) {
    const cur = counts.get(emoji) ?? { count: 0, mine: false }
    counts.set(emoji, { count: cur.count + 1, mine: true })
  }
  return REACTIONS.flatMap((e) => {
    const c = counts.get(e)
    return c && c.count > 0 ? [{ emoji: e, count: c.count, mine: c.mine }] : []
  })
}

/** Cập nhật một tin trong danh sách tin (cache React Query) */
export function applyReaction<T extends { id: string; reactions?: MessageReaction[] }>(list: readonly T[], messageId: string, emoji: string | null): T[] {
  return list.map((m) => (m.id === messageId ? { ...m, reactions: withMyReaction(m.reactions, emoji) } : m))
}
