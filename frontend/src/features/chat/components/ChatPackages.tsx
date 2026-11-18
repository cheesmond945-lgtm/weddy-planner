import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { Check, Loader2, PackageSearch, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { PACKAGE_PARAM } from '@/features/catalog/useOpenedPackage'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ChatPackage } from '@/types/chat'

/** Số gói tối đa đính kèm một lần (khớp backend MAX_PACKAGES_PER_SEND) */
export const MAX_ATTACHED_PACKAGES = 5

/** "4.500.000đ / bàn" hoặc "12.000.000đ" (trọn gói) */
export const packagePrice = (p: Pick<ChatPackage, 'price' | 'unit'>) => `${formatMoney(p.price)}${p.unit && p.unit !== 'gói' ? ` / ${p.unit}` : ''}`

/** Dòng phụ của thẻ gói: số bàn tối thiểu hoặc sức chứa */
const packageNote = (p: ChatPackage) => (p.minTables ? `Tối thiểu ${p.minTables} bàn` : p.capacity ? `${p.capacity} khách` : '')

/** Link mở khung chi tiết gói trên trang dịch vụ (cặp đôi) */
export const packageLink = (p: ChatPackage) => (p.serviceId ? `${paths.serviceDetail(p.serviceId)}?${PACKAGE_PARAM}=${p.id}` : null)

const Thumb = ({ src, className }: { src: string | null; className?: string }) =>
  src ? <img src={src} alt="" loading="lazy" className={cn('shrink-0 rounded-[10px] bg-gold-100 object-cover', className)} /> : <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-[10px] bg-gold-100 text-gold-700', className)}><PackageSearch className="size-5" strokeWidth={1.5} /></span>

/**
 * Thẻ gói trong tin Package (như "sản phẩm đang hỏi" trên sàn TMĐT): ảnh bìa, tên, giá, số bàn tối thiểu.
 * `linkable`: cặp đôi bấm thẻ mở lại khung chi tiết gói trên trang dịch vụ; gói đã ẩn thì ghi "Gói không còn hiển thị".
 */
export function PackageMessageCard({ pkg, mine, linkable }: { pkg: ChatPackage; mine: boolean; linkable: boolean }) {
  const href = linkable && pkg.available ? packageLink(pkg) : null
  const body = (
    <>
      <Thumb src={pkg.imageUrl} className="size-16" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Gói dịch vụ</span>
        <b className="mt-0.5 line-clamp-2 block font-serif text-[15px] leading-snug font-semibold text-ink">{pkg.name}</b>
        {pkg.available ? (
          <span className="mt-1 block text-[13px] text-ink-2">
            <b className="font-semibold text-gold-700">{packagePrice(pkg)}</b>
            {packageNote(pkg) && <span className="text-ink-3"> · {packageNote(pkg)}</span>}
          </span>
        ) : (
          <span className="mt-1 block text-[12.5px] text-ink-3">Gói không còn hiển thị</span>
        )}
        {href && <span className="mt-1 block text-[12.5px] font-semibold text-gold-700">Xem gói ›</span>}
      </span>
    </>
  )
  const box = cn(
    'flex w-[min(300px,100%)] items-start gap-3 rounded-[18px] border bg-surface p-2.5 text-left',
    mine ? 'rounded-br-[5px] border-gold-700/40' : 'rounded-bl-[5px] border-line',
  )
  return href ? (
    <Link to={href} className={cn(box, 'transition-colors hover:border-gold-700')} aria-label={`Xem gói ${pkg.name}`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}

/** Các gói đang đính kèm trên ô nhập (chưa gửi): bấm × để bỏ từng gói. */
export function AttachedPackages({ items, onRemove }: { items: ChatPackage[]; onRemove: (id: string) => void }) {
  if (!items.length) return null
  return (
    <div className="rounded-[14px] border border-line bg-surface-2 px-3 py-2">
      <p className="mb-1.5 text-[12px] text-ink-3">{items.length > 1 ? `Đính kèm ${items.length} gói` : 'Bạn đang hỏi về gói'}</p>
      <ul className="grid gap-1.5">
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5">
            <Thumb src={p.imageUrl} className="size-9 rounded-[8px]" />
            <span className="min-w-0 flex-1 text-[13px] leading-tight">
              <b className="block truncate font-semibold text-ink">{p.name}</b>
              <span className="text-[12px] text-gold-700">{packagePrice(p)}</span>
            </span>
            <button type="button" aria-label={`Bỏ gói ${p.name}`} title="Bỏ gói" onClick={() => onRemove(p.id)} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-bg hover:text-ink">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Nút "Gửi gói" cạnh nút đính kèm: mở danh sách gói của NCC trong hội thoại (ảnh, tên, giá), chọn một hoặc nhiều gói (tối đa 5)
 * rồi đính kèm lên ô nhập. Chưa gửi ngay: người dùng bấm Gửi mới gửi.
 */
export function PackagePickerButton({
  queryKey,
  load,
  selected,
  onPick,
  className,
}: {
  queryKey: QueryKey
  load: () => Promise<ChatPackage[]>
  /** Các gói đang đính kèm (đánh dấu sẵn khi mở) */
  selected: ChatPackage[]
  onPick: (items: ChatPackage[]) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const { data: packages = [], isPending, isError } = useQuery({ queryKey, queryFn: load, enabled: open, staleTime: 60_000 })
  const toggle = (id: string) =>
    setPicked((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id)
      if (list.length >= MAX_ATTACHED_PACKAGES) {
        toast(`Chọn tối đa ${MAX_ATTACHED_PACKAGES} gói một lần`)
        return list
      }
      return [...list, id]
    })
  return (
    <>
      <button
        type="button"
        aria-label="Gửi gói dịch vụ"
        title="Gửi gói dịch vụ"
        onClick={() => {
          setPicked(selected.map((p) => p.id))
          setOpen(true)
        }}
        className={cn('grid size-10 flex-none place-items-center rounded-full text-muted-foreground transition-colors hover:bg-bg hover:text-ink [&_svg]:size-[19px]', className)}
      >
        <PackageSearch />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Gửi gói dịch vụ</DialogTitle>
            <DialogDescription>Chọn một hoặc nhiều gói để hỏi hoặc so sánh (tối đa {MAX_ATTACHED_PACKAGES} gói).</DialogDescription>
          </DialogHeader>
          {isPending ? (
            <div className="grid h-32 place-items-center text-ink-3" aria-label="Đang tải gói">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Không tải được danh sách gói. Thử lại sau.</p>
          ) : !packages.length ? (
            <p className="text-sm text-muted-foreground">Nhà cung cấp chưa có gói nào đang hiển thị.</p>
          ) : (
            <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto pr-1">
              {packages.map((p) => {
                const on = picked.includes(p.id)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(p.id)}
                      className={cn('flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left transition-colors', on ? 'border-gold-700 bg-gold-100/60' : 'border-line hover:border-gold-500')}
                    >
                      <Thumb src={p.imageUrl} className="size-14" />
                      <span className="min-w-0 flex-1">
                        <b className="line-clamp-2 block text-[14px] leading-snug font-semibold text-ink">{p.name}</b>
                        <span className="mt-0.5 block text-[13px] text-gold-700">{packagePrice(p)}</span>
                        {packageNote(p) && <span className="block text-[12px] text-ink-3">{packageNote(p)}</span>}
                      </span>
                      <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-full border', on ? 'border-gold-700 bg-gold-700 text-white' : 'border-line-strong')}>
                        {on && <Check className="size-3.5" strokeWidth={2.5} />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={!picked.length}
              onClick={() => {
                // Giữ thứ tự đã chọn
                onPick(picked.flatMap((id) => packages.find((p) => p.id === id) ?? selected.find((p) => p.id === id) ?? []))
                setOpen(false)
              }}
            >
              {picked.length ? `Đính kèm ${picked.length} gói` : 'Đính kèm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Gói đang đính kèm trên ô nhập và cách gửi: gửi các thẻ gói trước rồi mới tới tin chữ (nếu có).
 * Gửi xong thêm tin vào cache để hiện ngay và làm mới danh sách hội thoại.
 */
export function useAttachedPackages<M extends { id: string }>(messagesKey: QueryKey, conversationsKey: QueryKey, send: (ids: string[], replyToId?: string | null) => Promise<M[]>) {
  const qc = useQueryClient()
  const [items, setItems] = useState<ChatPackage[]>([])
  const [sending, setSending] = useState(false)
  return {
    items,
    sending,
    set: setItems,
    remove: (id: string) => setItems((list) => list.filter((p) => p.id !== id)),
    /** Gửi các gói đang đính kèm; trả false nếu lỗi (giữ nguyên gói để gửi lại) */
    async flush(replyToId?: string | null) {
      if (!items.length) return true
      setSending(true)
      try {
        const sent = await send(
          items.map((p) => p.id),
          replyToId,
        )
        qc.setQueryData<M[]>(messagesKey, (list = []) => [...list, ...sent.filter((m) => !list.some((x) => x.id === m.id))])
        void qc.invalidateQueries({ queryKey: conversationsKey })
        setItems([])
        return true
      } catch (e) {
        toast((e as Error).message || 'Không gửi được gói, thử lại sau')
        return false
      } finally {
        setSending(false)
      }
    },
  }
}
