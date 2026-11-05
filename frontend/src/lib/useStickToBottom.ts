import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/** Cách đáy dưới ngưỡng này (px) vẫn coi là đang ở cuối khung */
const NEAR_BOTTOM = 80

/**
 * Khung tin nhắn: `key` đổi (mở hội thoại, có tin mới) thì cuộn xuống tin cuối, rồi giữ ở cuối khi nội dung cao lên sau đó
 * (tin tải xong, ảnh, thẻ đơn hiện muộn). Người dùng đã cuộn lên đọc tin cũ thì không kéo xuống nữa, đến lần `key` đổi kế tiếp.
 */
export function useStickToBottom(ref: RefObject<HTMLElement | null>, key: unknown) {
  const stick = useRef(true)

  useLayoutEffect(() => {
    stick.current = true
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [ref, key])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const toBottom = () => {
      if (stick.current) el.scrollTop = el.scrollHeight
    }
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
    }
    const resize = new ResizeObserver(toBottom)
    resize.observe(el)
    const mutation = new MutationObserver(toBottom)
    mutation.observe(el, { childList: true, subtree: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    // Ảnh trong tin tải xong làm khung cao lên (sự kiện load không nổi bọt nên bắt ở pha capture)
    el.addEventListener('load', toBottom, true)
    return () => {
      resize.disconnect()
      mutation.disconnect()
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('load', toBottom, true)
    }
  }, [ref, key])
}
