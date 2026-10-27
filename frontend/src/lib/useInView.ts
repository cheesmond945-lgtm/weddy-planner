import { useEffect, useRef, useState } from 'react'

/** true khi phần tử vào (gần) vùng nhìn thấy; sau đó giữ true. Dùng để chỉ tải dữ liệu khi cần. */
export function useInView<T extends Element>(rootMargin = '120px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView, rootMargin])

  return { ref, inView }
}
