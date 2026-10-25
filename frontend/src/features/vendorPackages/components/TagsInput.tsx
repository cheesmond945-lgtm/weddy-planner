import { X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { addTag } from '../packageForm'

interface TagsInputProps {
  id?: string
  tags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}

/** Nhập tag: Enter để thêm, Backspace ở ô trống để xóa tag cuối. */
export function TagsInput({ id, tags, onChange, disabled }: TagsInputProps) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const next = addTag(tags, raw)
    if (next !== tags) onChange(next)
    setText('')
  }

  return (
    <div className={cn('flex min-h-10 flex-wrap items-center gap-1.5 rounded-sm border border-line-strong bg-surface py-[5px] pr-1.5 pl-2 focus-within:border-gold', disabled && 'bg-surface-2')}>
      {tags.map((t) => (
        <span key={t} className="inline-flex h-7 items-center gap-1 rounded-pill bg-gold-soft pr-1 pl-[11px] text-[13px] font-medium text-gold-ink">
          {t}
          {!disabled && (
            <button type="button" aria-label={`Xóa tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="grid size-[22px] place-items-center rounded-full hover:bg-ink/10">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <>
          <input
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(text)
              } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1))
            }}
            aria-label="Thêm tag"
            placeholder={tags.length ? 'Thêm tag…' : 'Nhập tag rồi nhấn Enter'}
            className="h-[30px] min-w-[140px] flex-1 bg-transparent px-1.5 text-[13.5px] outline-none"
          />
          <button type="button" disabled={!text.trim()} onClick={() => add(text)} className="h-8 rounded-sm px-3 text-[13px] font-medium hover:bg-surface-2 disabled:opacity-40">
            Thêm
          </button>
        </>
      )}
      {disabled && !tags.length && <span className="px-1.5 text-[13.5px] text-muted-foreground">Chưa có tag</span>}
    </div>
  )
}
