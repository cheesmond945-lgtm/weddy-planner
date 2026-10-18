import { Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useReveal } from '@/lib/useReveal'

interface ServiceSearchBarProps {
  value: string
  onSearch: (q: string) => void
}

/** Ô tìm dịch vụ (2.1). Lọc ngay khi gõ (trễ 300ms), Enter hoặc nút TÌM KIẾM thì lọc luôn. */
export function ServiceSearchBar({ value, onSearch }: ServiceSearchBarProps) {
  const [text, setText] = useState(value)
  const reveal = useReveal<HTMLDivElement>()

  // URL đổi từ nơi khác (Xóa bộ lọc) thì cập nhật ô nhập
  useEffect(() => setText(value), [value])

  useEffect(() => {
    if (text === value) return
    const t = setTimeout(() => onSearch(text), 300)
    return () => clearTimeout(t)
  }, [text]) // chỉ chạy khi người dùng gõ

  function submit(e: FormEvent) {
    e.preventDefault()
    onSearch(text)
  }

  return (
    <div ref={reveal.ref} className={`mx-auto mb-[22px] max-w-[850px] ${reveal.className}`}>
      <form
        role="search"
        onSubmit={submit}
        className="flex items-center gap-3 rounded-pill border border-line-soft bg-surface py-1.5 pr-2 pl-5 shadow-header focus-within:border-primary"
      >
        <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Tìm "Sảnh cưới sân vườn"'
          aria-label="Tìm dịch vụ"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2.5 text-xs text-ink outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" className="rounded-pill px-[22px] text-[11px] tracking-[0.08em]">
          <Search className="size-[15px]" />
          TÌM KIẾM
        </Button>
      </form>
    </div>
  )
}
