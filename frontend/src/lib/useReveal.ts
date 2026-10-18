import { useEffect, useRef, useState } from 'react'

/**
 * Hiện dần khi cuộn tới (như .scroll-reveal trong prototype).
 * Trả ref gắn vào phần tử và class cần thêm.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -35px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  const className = `transition-[opacity,translate] duration-[550ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${
    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[22px] motion-reduce:opacity-100 motion-reduce:translate-y-0'
  }`
  return { ref, className }
}
