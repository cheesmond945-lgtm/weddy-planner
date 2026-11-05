import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import type { MessageReaction } from '@/types/chat'
import { applyReaction } from './reactions'

type WithReactions = { id: string; reactions?: MessageReaction[] }

/**
 * Thả / đổi / gỡ cảm xúc một tin: cập nhật lạc quan danh sách tin trong cache (`key`), lỗi thì trả lại như cũ.
 * `react` gọi API của phía đang dùng (cặp đôi hoặc NCC).
 */
export function useMessageReaction(key: QueryKey, react: (messageId: string, emoji: string | null) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string | null }) => react(messageId, emoji),
    onMutate: async ({ messageId, emoji }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<WithReactions[]>(key)
      if (prev) qc.setQueryData(key, applyReaction(prev, messageId, emoji))
      return { prev }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast(e.message)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  })
}
