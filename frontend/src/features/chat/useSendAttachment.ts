import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { AttachmentInput } from '@/api/chat'
import { toast } from '@/components/ui/toast'

/** Tối đa 25MB mỗi tệp (khớp backend MAX_ATTACHMENT_BYTES) */
export const MAX_ATTACHMENT_BYTES = 25 * 1048576

/**
 * Gửi ảnh / tệp / ghi âm: upload xong thì thêm tin vào danh sách tin trong cache (`key`) và tải lại danh sách hội thoại (`listKey`).
 * `upload` gọi API của phía đang dùng (cặp đôi hoặc NCC). Tệp quá 25MB bị chặn ngay ở máy.
 */
export function useSendAttachment<T extends { id: string }>(key: QueryKey, listKey: QueryKey, upload: (input: AttachmentInput) => Promise<T>) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: upload,
    onSuccess: (msg) => {
      qc.setQueryData<T[]>(key, (list = []) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]))
      void qc.invalidateQueries({ queryKey: listKey })
    },
    onError: (e) => toast(e.message),
  })
  /** Gửi lần lượt từng tệp (giữ đúng thứ tự đã chọn); chỉ tin đầu tiên mang `replyToId` */
  async function sendFiles(files: File[], replyToId?: string | null) {
    const ok = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
    if (ok.length < files.length) toast('Tệp tối đa 25MB, các tệp lớn hơn đã bị bỏ qua.')
    for (const [i, file] of ok.entries()) {
      await mutation.mutateAsync({ file, name: file.name, replyToId: i === 0 ? replyToId : null }).catch(() => undefined)
    }
  }
  return { sendFiles, send: mutation.mutateAsync, isPending: mutation.isPending }
}
