/*
 * Gộp ảnh gửi liền nhau thành một album (như Messenger): các tin Image liên tiếp của cùng người gửi, cách nhau không quá ALBUM_GAP_MS,
 * tin sau không trả lời tin nào. Hàm thuần (có test), dùng chung cho khung chat phía cặp đôi và NCC.
 */

/** Ảnh gửi cách nhau tối đa 2 phút vẫn tính là một album (chọn nhiều ảnh thì upload lần lượt) */
export const ALBUM_GAP_MS = 2 * 60_000

interface AlbumMessage {
  id: string
  type: string
  sender: string
  sentDate: string
  replyTo?: unknown
  recalled?: boolean
}

export interface Albums<T> {
  /** id tin đầu album → mọi tin ảnh của album (theo thứ tự gửi) */
  byFirst: Map<string, T[]>
  /** id các tin ảnh sau tin đầu: không vẽ riêng (đã nằm trong album của tin đầu) */
  hidden: Set<string>
}

/** Album có từ 2 ảnh trở lên; ảnh lẻ không vào album */
export function groupAlbums<T extends AlbumMessage>(messages: readonly T[]): Albums<T> {
  const byFirst = new Map<string, T[]>()
  const hidden = new Set<string>()
  let run: T[] = []
  const flush = () => {
    if (run.length > 1) {
      byFirst.set(run[0].id, run)
      for (const m of run.slice(1)) hidden.add(m.id)
    }
    run = []
  }
  // Ảnh đã thu hồi không vào album (hiện dòng "đã thu hồi" riêng)
  const isImage = (m: T) => m.type === 'Image' && !m.recalled
  for (const m of messages) {
    const prev = run.at(-1)
    const joins = !!prev && isImage(m) && m.sender === prev.sender && !m.replyTo && Date.parse(m.sentDate) - Date.parse(prev.sentDate) <= ALBUM_GAP_MS
    if (joins) {
      run.push(m)
      continue
    }
    flush()
    if (isImage(m)) run = [m]
  }
  flush()
  return { byFirst, hidden }
}
