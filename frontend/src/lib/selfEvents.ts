/*
 * Sự kiện realtime do CHÍNH MÌNH gây ra: khi vừa đổi một việc, backend vẫn báo "task" về cho mọi phiên của mình, kể cả phiên này,
 * nhưng giao diện đã cập nhật sẵn nên không cần tải lại. markSelf ghi nhớ id việc trong ít giây, isSelfEvent cho RealtimeBridge bỏ qua sự kiện đó.
 * Phiên khác (tab khác, máy khác) không có ghi nhớ này nên vẫn tải lại bình thường.
 */
const SELF_MS = 10_000
const mine = new Map<string, number>()

export function markSelf(id: string, now = Date.now()) {
  mine.set(id, now + SELF_MS)
  // dọn các mục đã hết hạn để Map không phình
  for (const [k, until] of mine) if (until < now) mine.delete(k)
}

export function isSelfEvent(id: string | null | undefined, now = Date.now()): boolean {
  if (!id) return false
  const until = mine.get(id)
  if (until === undefined) return false
  if (until < now) {
    mine.delete(id)
    return false
  }
  return true
}
