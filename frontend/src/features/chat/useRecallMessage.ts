import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'

type Recallable = { id: string; recalled?: boolean }

/**
 * Thu hồi tin của chính mình (như Messenger): đánh dấu đã thu hồi ngay trong cache (`key`), lỗi thì trả lại như cũ.
 * `recall` gọi API của phía đang dùng (cặp đôi hoặc NCC).
 */
export function useRecallMessage(key: QueryKey, recall: (messageId: string) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recall,
    onMutate: async (messageId) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Recallable[]>(key)
      if (prev) qc.setQueryData(key, prev.map((m) => (m.id === messageId ? { ...m, recalled: true, attachment: null, reactions: [], replyTo: null } : m)))
      return { prev }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast(e.message)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  })
}
