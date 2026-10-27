import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { hasPrice, PRICE_PRESETS, priceLabel, type PriceRange } from '../filters'

const MOBILE_QUERY = '(max-width: 699px)'

/** Đang ở màn hình hẹp (< 700px): thanh tìm kiếm xếp dọc, mức giá mở bảng trượt từ dưới lên thay popover. */
function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(MOBILE_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
  )
}

interface ServiceSearchBarProps {
  q: string
  price: PriceRange
  /** Bấm Tìm kiếm / Enter: lọc theo từ khóa */
  onSearch: (q: string) => void
  /** Bấm "Áp dụng" / "Xóa" trong ô Mức giá */
  onPrice: (price: PriceRange) => void
}

/**
 * Thanh tìm kiếm (13): [từ khóa] | [Mức giá ▾] | [Tìm kiếm].
 * Từ khóa tìm theo tên dịch vụ, tên NCC và địa chỉ, không phân biệt dấu (BE so khớp); chỉ lọc khi bấm Tìm kiếm hoặc Enter.
 * Mức giá chỉ lọc khi bấm "Áp dụng". Điện thoại: xếp dọc, nút Tìm kiếm rộng hết.
 */
export function ServiceSearchBar({ q, price, onSearch, onPrice }: ServiceSearchBarProps) {
  const [text, setText] = useState(q)
  const mobile = useIsMobile()
  // URL đổi từ nơi khác (Xóa bộ lọc, bỏ tag) thì cập nhật ô nhập
  useEffect(() => setText(q), [q])

  function submit(e: FormEvent) {
    e.preventDefault()
    onSearch(text)
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="mx-auto flex h-[60px] max-w-[850px] items-center rounded-pill border border-line bg-surface p-1.5 pl-5 shadow-md max-[699px]:h-auto max-[699px]:flex-col max-[699px]:items-stretch max-[699px]:gap-1.5 max-[699px]:rounded-2xl max-[699px]:p-2"
    >
      <label className="flex min-w-0 flex-1 items-center gap-3 max-[699px]:h-12 max-[699px]:px-3">
        <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Điện thoại hẹp: gợi ý ngắn để không bị cắt mất ví dụ
          placeholder={mobile ? 'Tên hoặc địa điểm, vd "Cầu Giấy"' : 'Tìm theo tên hoặc địa điểm, ví dụ "Cầu Giấy"'}
          aria-label="Tìm theo tên dịch vụ, nhà cung cấp hoặc địa điểm"
          className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </label>
      <span aria-hidden className="mx-2 h-8 w-px shrink-0 bg-line max-[699px]:mx-0 max-[699px]:h-px max-[699px]:w-full" />
      <PricePicker value={price} onApply={onPrice} />
      <button
        type="submit"
        className="ml-2 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-pill bg-gold-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-gold-800 max-[699px]:ml-0 max-[699px]:w-full"
      >
        <Search className="size-4" aria-hidden />
        Tìm kiếm
      </button>
    </form>
  )
}

/** Phân đoạn "Mức giá": nút hiện giá trị đang lọc, bấm mở popover (máy tính) hoặc bảng trượt (điện thoại). */
function PricePicker({ value, onApply }: { value: PriceRange; onApply: (p: PriceRange) => void }) {
  const [open, setOpen] = useState(false)
  const mobile = useIsMobile()
  const wrapRef = useRef<HTMLDivElement>(null)
  const active = hasPrice(value)

  // Popover máy tính: bấm ra ngoài hoặc Esc thì đóng (bảng trượt điện thoại do Dialog lo)
  useEffect(() => {
    if (!open || mobile) return
    const onDown = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, mobile])

  const apply = (p: PriceRange) => {
    onApply(p)
    setOpen(false)
  }
  const panel = <PricePanel key={`${value.min}-${value.max}-${open}`} value={value} onApply={apply} />

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-12 min-w-[150px] items-center justify-between gap-2 rounded-pill px-4 text-[15px] transition-colors hover:bg-bg max-[699px]:w-full max-[699px]:rounded-xl max-[699px]:px-3"
      >
        <span className={cn(active ? 'font-semibold text-gold-700' : 'text-ink-2')}>{active ? priceLabel(value) : 'Mức giá'}</span>
        <ChevronDown className={cn('size-4 text-ink-2 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {mobile ? (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(43_38_32/0.35)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl text-left border-t border-line bg-surface px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
            >
              <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-pill bg-line" />
              <DialogPrimitive.Title className="mb-3 font-serif text-lg font-semibold">Mức giá</DialogPrimitive.Title>
              {panel}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      ) : (
        open && (
          <div role="dialog" aria-label="Mức giá" className="absolute top-full right-0 z-30 mt-3 w-[360px] rounded-xl border border-line bg-surface p-5 text-left shadow-md animate-in fade-in zoom-in-95">
            {panel}
          </div>
        )
      )}
    </div>
  )
}

/** Mức chọn nhanh (bấm lại để bỏ) + ô "Từ" / "Đến" (triệu đồng) + Áp dụng / Xóa. */
function PricePanel({ value, onApply }: { value: PriceRange; onApply: (p: PriceRange) => void }) {
  const toMillion = (n?: number) => (n === undefined ? '' : String(n / 1_000_000))
  const [from, setFrom] = useState(toMillion(value.min))
  const [to, setTo] = useState(toMillion(value.max))

  const parse = (s: string) => {
    const n = Number(s.replace(',', '.'))
    return s.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 1_000_000) : undefined
  }
  const draft: PriceRange = { min: parse(from), max: parse(to) }
  const invalid = draft.min !== undefined && draft.max !== undefined && draft.min >= draft.max

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRICE_PRESETS.map((p) => {
          const min = 'min' in p ? p.min : undefined
          const max = 'max' in p ? p.max : undefined
          const selected = draft.min === min && draft.max === max
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setFrom(selected ? '' : toMillion(min))
                setTo(selected ? '' : toMillion(max))
              }}
              className={cn(
                'h-9 rounded-pill border px-3.5 text-[13px] font-medium transition-colors',
                selected ? 'border-moss-700 bg-moss-700 text-white' : 'border-line bg-surface text-ink-2 hover:border-gold-500 hover:text-ink',
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <PriceInput label="Từ" value={from} onChange={setFrom} />
        <PriceInput label="Đến" value={to} onChange={setTo} />
      </div>
      {invalid && <p className="mt-2 text-[13px] text-destructive">Giá "Đến" cần lớn hơn giá "Từ".</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => onApply({})} className="h-10 px-2 text-sm font-medium text-ink-2 hover:text-ink hover:underline">
          Xóa
        </button>
        <button
          type="button"
          disabled={invalid}
          onClick={() => onApply(draft)}
          className="h-10 rounded-pill bg-gold-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-gold-800 disabled:opacity-50"
        >
          Áp dụng
        </button>
      </div>
    </div>
  )
}

function PriceInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): ReactNode {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      <span className="flex h-10 items-center rounded-md border border-line bg-surface px-3 focus-within:border-gold-700">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="0"
          aria-label={`Giá ${label.toLowerCase()} (triệu đồng)`}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none"
        />
        <span className="text-[13px] text-ink-3">triệu</span>
      </span>
    </label>
  )
}
