import { useState, type FormEvent } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { GUEST_GROUPS, type Guest, type GuestSide } from '@/types/wedding'
import { useGuestMutations } from '../hooks'

export const SIDE_LABEL: Record<GuestSide, string> = { GROOM: 'Nhà trai', BRIDE: 'Nhà gái' }
const CUSTOM = '__custom'
const select = 'w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px]'

/** Chọn bên Nhà trai / Nhà gái. */
function SidePicker({ value, onChange }: { value: GuestSide; onChange: (s: GuestSide) => void }) {
  return (
    <div role="radiogroup" aria-label="Bên" className="flex gap-2">
      {(['GROOM', 'BRIDE'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn('flex-1 rounded-sm border px-3 py-2.5 text-sm font-medium', value === s ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-primary')}
        >
          {SIDE_LABEL[s]}
        </button>
      ))}
    </div>
  )
}

/** Nhóm: chọn nhóm có sẵn hoặc tự nhập (tối đa 30 ký tự). */
function GroupPicker({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  const known = GUEST_GROUPS.includes(value)
  const [custom, setCustom] = useState(!known)
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium">
        Nhóm
        <select
          className={cn(select, 'mt-1.5 font-normal')}
          value={custom ? CUSTOM : value}
          onChange={(e) => {
            const v = e.target.value
            setCustom(v === CUSTOM)
            onChange(v === CUSTOM ? '' : v)
          }}
        >
          {GUEST_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value={CUSTOM}>Tự nhập…</option>
        </select>
      </label>
      {custom && <Input aria-label="Tên nhóm" placeholder="Ví dụ: Hội đồng hương" maxLength={30} value={value} onChange={(e) => onChange(e.target.value)} autoFocus />}
    </div>
  )
}

/** Thêm hoặc sửa một khách. `guest` null là thêm mới. */
export function GuestFormDialog({ open, guest, onClose }: { open: boolean; guest: Guest | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{guest ? 'Sửa thông tin khách' : 'Thêm khách'}</DialogTitle>
          <DialogDescription className="sr-only">Tên, bên, nhóm và số người</DialogDescription>
        </DialogHeader>
        {open && <GuestForm guest={guest} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function GuestForm({ guest, onClose }: { guest: Guest | null; onClose: () => void }) {
  const { add, update } = useGuestMutations()
  const [fullName, setFullName] = useState(guest?.fullName ?? '')
  const [side, setSide] = useState<GuestSide>(guest?.side ?? 'GROOM')
  const [group, setGroup] = useState(guest?.group ?? 'Bạn bè')
  const [partySize, setPartySize] = useState(String(guest?.partySize ?? 1))
  const [error, setError] = useState<string>()
  const pending = add.isPending || update.isPending

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(partySize)
    if (!fullName.trim()) return setError('Nhập tên khách.')
    if (!group.trim()) return setError('Nhập tên nhóm.')
    if (!Number.isInteger(n) || n < 1 || n > 50) return setError('Số người là số nguyên từ 1 đến 50.')
    setError(undefined)
    const body = { fullName: fullName.trim(), side, group: group.trim(), partySize: n }
    const done = (msg: string) => () => {
      toast(msg)
      onClose()
    }
    if (guest) update.mutate({ id: guest.id, patch: body }, { onSuccess: done('Đã cập nhật khách') })
    else add.mutate({ ...body, isInvited: false, rsvp: 'PENDING' }, { onSuccess: done('Đã thêm khách') })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField label="Tên khách" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
      <SidePicker value={side} onChange={setSide} />
      <GroupPicker value={group} onChange={setGroup} />
      <FormField label="Số người (tính cả khách)" type="number" min={1} max={50} value={partySize} onChange={(e) => setPartySize(e.target.value)} />
      <FormError message={error ?? add.error?.message ?? update.error?.message} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {guest ? 'Lưu' : 'Thêm khách'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Thêm nhiều khách: mỗi dòng một tên, chung bên và nhóm. */
export function BulkGuestsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm nhiều khách</DialogTitle>
          <DialogDescription>Mỗi dòng một tên. Các khách dùng chung bên và nhóm.</DialogDescription>
        </DialogHeader>
        {open && <BulkForm onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function BulkForm({ onClose }: { onClose: () => void }) {
  const { addMany } = useGuestMutations()
  const [text, setText] = useState('')
  const [side, setSide] = useState<GuestSide>('GROOM')
  const [group, setGroup] = useState('Bạn bè')
  const [error, setError] = useState<string>()
  const names = text
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!names.length) return setError('Nhập ít nhất một tên.')
    if (!group.trim()) return setError('Nhập tên nhóm.')
    setError(undefined)
    addMany.mutate(
      { names, side, group: group.trim() },
      {
        onSuccess: () => {
          toast(`Đã thêm ${names.length} khách`)
          onClose()
        },
      },
    )
  }

  const dup = (addMany.error as { details?: { duplicates?: string[] } } | null)?.details?.duplicates

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <label className="text-[13px] font-medium">
        Danh sách tên {names.length > 0 && <span className="font-normal text-muted-foreground">({names.length} khách)</span>}
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Nguyễn Văn An\nTrần Thị Bình'}
          className="mt-1.5 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] font-normal"
          autoFocus
        />
      </label>
      <SidePicker value={side} onChange={setSide} />
      <GroupPicker value={group} onChange={setGroup} />
      <FormError message={error ?? (addMany.error && (dup?.length ? `${addMany.error.message} ${dup.join(', ')}` : addMany.error.message))} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={addMany.isPending}>
          Thêm {names.length || ''} khách
        </Button>
      </DialogFooter>
    </form>
  )
}
