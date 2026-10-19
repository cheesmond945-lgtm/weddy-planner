import type { LucideIcon } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type RowMenuItem = { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean } | 'separator'

const WIDTH = 210

/** Nút "…" mở menu thao tác của một dòng (RowMenu trong prototype NCC). Menu nổi trên bảng, tự lật lên khi sát đáy màn hình. */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return setPos(null)
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect()
      const h = menuRef.current?.offsetHeight ?? items.length * 40 + 12
      const up = window.innerHeight - r.bottom < h + 12 && r.top > h + 12
      setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - WIDTH - 8, r.right - WIDTH)) })
    }
    place()
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, items.length])

  // Mở menu thì đưa focus vào mục đầu
  useLayoutEffect(() => {
    if (open && pos) menuRef.current?.querySelector('button')?.focus()
  }, [open, pos])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Thao tác: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Thao tác"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid size-[34px] place-items-center rounded-sm border border-transparent text-muted-foreground transition-colors hover:bg-gold-soft hover:text-gold-ink',
          open && 'border-gold/35 bg-gold-soft text-gold-ink',
        )}
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
              e.preventDefault()
              const btns = [...(menuRef.current?.querySelectorAll('button') ?? [])]
              const i = btns.indexOf(document.activeElement as HTMLButtonElement)
              btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus()
            }}
            className="fixed z-[500] grid gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-portal-lift animate-in fade-in zoom-in-95"
          >
            {items.map((it, i) =>
              it === 'separator' ? (
                <div key={i} role="separator" className="mx-1.5 my-1 h-px bg-line" />
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    it.onClick()
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-[9px] text-left text-[13.5px] outline-none [&_svg]:size-4',
                    it.danger ? 'text-warn hover:bg-warn-soft focus:bg-warn-soft' : 'text-ink hover:bg-gold-soft hover:text-gold-ink focus:bg-gold-soft focus:text-gold-ink [&_svg]:text-muted-foreground',
                  )}
                >
                  <it.icon />
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
