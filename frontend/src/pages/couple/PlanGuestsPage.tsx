import { Download, FileSpreadsheet, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { weddingsApi } from '@/api/weddings'
import { Donut } from '@/features/weddings/components/Donut'
import { BulkGuestsDialog, GuestFormDialog, SIDE_LABEL } from '@/features/weddings/components/GuestDialogs'
import { StatCard, StatGrid } from '@/features/weddings/components/StatCard'
import { useGuestMutations, useGuests } from '@/features/weddings/hooks'
import { ImportDialog } from '@/features/weddings/import/ImportDialog'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Guest, GuestRsvp } from '@/types/wedding'

const RSVP_LABEL: Record<GuestRsvp, string> = { PENDING: 'Chưa phản hồi', ATTENDING: 'Sẽ đến', DECLINED: 'Từ chối' }

const FILTERS = [
  { key: '', label: 'Tất cả', match: () => true },
  { key: 'groom', label: 'Nhà trai', match: (g: Guest) => g.side === 'GROOM' },
  { key: 'bride', label: 'Nhà gái', match: (g: Guest) => g.side === 'BRIDE' },
  { key: 'not-invited', label: 'Chưa mời', match: (g: Guest) => !g.isInvited },
  { key: 'attending', label: 'Sẽ đến', match: (g: Guest) => g.rsvp === 'ATTENDING' },
]

const chip = (active: boolean) =>
  cn('rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors', active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-primary')

/** Subtab Khách mời (P5): thẻ số, phản hồi, nhà trai/nhà gái, danh sách có lọc. Lọc lưu trên URL ?loc=. */
export default function PlanGuestsPage() {
  const guests = useGuests()
  const { add, update, remove } = useGuestMutations()
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.key === (params.get('loc') ?? '')) ?? FILTERS[0]
  const [editing, setEditing] = useState<Guest | 'new' | null>(null)
  const [bulk, setBulk] = useState(false)
  const [importing, setImporting] = useState(false)

  if (guests.isPending) return <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải khách mời" />
  if (guests.isError) {
    return (
      <EmptyState
        title="Không tải được danh sách khách"
        description={guests.error.message}
        action={
          <Button variant="outline" onClick={() => guests.refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  const { items, stats: s } = guests.data
  const visible = items.filter(filter.match)
  const overBy = s.total - s.expected
  const sideTotal = s.bride + s.groom || 1

  function removeGuest(g: Guest) {
    remove.mutate(g.id, {
      onSuccess: () =>
        toast(`Đã xóa ${g.fullName}`, {
          action: {
            label: 'Hoàn tác',
            onClick: () => add.mutate({ fullName: g.fullName, side: g.side, group: g.group, partySize: g.partySize, isInvited: g.isInvited, rsvp: g.rsvp }),
          },
        }),
    })
  }

  return (
    <>
      <StatGrid>
        <StatCard
          label="Tổng khách"
          value={
            <>
              {formatNumber(s.total)}
              <span className="text-base font-normal text-muted-foreground">/{formatNumber(s.expected)}</span>
            </>
          }
          sub={overBy > 0 ? <span className="text-warn">Vượt {overBy} khách so với dự kiến</span> : 'so với số khách dự kiến'}
        />
        <StatCard label="Đã mời" value={formatNumber(s.invited)} />
        <StatCard label="Sẽ đến" value={formatNumber(s.attending)} tone="good" />
        <StatCard label="Từ chối" value={formatNumber(s.declined)} />
        <StatCard label="Chưa phản hồi" value={formatNumber(s.pending)} />
      </StatGrid>

      {items.length > 0 && (
        <div className="mb-5 grid grid-cols-[1.2fr_1fr] gap-4 max-[900px]:grid-cols-1">
          <section className="rounded-lg border border-line bg-surface px-[22px] py-5">
            <h2 className="mb-3.5 text-lg">Phản hồi của khách mời</h2>
            <Donut
              label="Phản hồi của khách mời"
              center={
                <span>
                  <b className="block font-serif text-xl">{formatNumber(s.attending)}</b>sẽ đến
                </span>
              }
              slices={[
                { key: 'a', label: 'Sẽ đến', value: s.attending, color: 'var(--sage)' },
                { key: 'p', label: 'Chưa phản hồi', value: s.pending, color: 'var(--gold)' },
                { key: 'd', label: 'Từ chối', value: s.declined, color: 'var(--warn)' },
                { key: 'n', label: 'Chưa mời', value: s.notInvited, color: 'var(--line-strong)' },
              ]}
            />
          </section>
          <section className="rounded-lg border border-line bg-surface px-[22px] py-5">
            <h2 className="mb-3.5 text-lg">Nhà trai và nhà gái</h2>
            <div className="flex justify-between text-sm">
              <span>
                Nhà trai <b>{formatNumber(s.groom)}</b>
              </span>
              <span>
                <b>{formatNumber(s.bride)}</b> Nhà gái
              </span>
            </div>
            <div role="img" aria-label={`Nhà trai ${s.groom} khách, nhà gái ${s.bride} khách`} className="mt-2 flex h-3 overflow-hidden rounded-pill bg-line">
              <i className="block h-full bg-[var(--c1)]" style={{ width: `${(s.groom / sideTotal) * 100}%` }} />
              <i className="block h-full bg-[var(--c2)]" style={{ width: `${(s.bride / sideTotal) * 100}%` }} />
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">Tính theo số người, gồm cả người đi cùng.</p>
          </section>
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 px-[22px] pt-5 pb-3.5">
          <div role="group" aria-label="Lọc khách" className="mr-auto flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter.key === f.key}
                className={chip(filter.key === f.key)}
                onClick={() => setParams(f.key ? { loc: f.key } : {}, { replace: true, preventScrollReset: true })}
              >
                {f.label} <span className="opacity-70">{items.filter(f.match).length}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" disabled={!items.length} onClick={() => weddingsApi.downloadExport('guests').catch((e: Error) => toast(e.message))}>
            <Download />
            Tải về
          </Button>
          <>
              <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
                <FileSpreadsheet />
                Nhập từ Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulk(true)}>
                <ListPlus />
                Thêm nhiều
              </Button>
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus />
                Thêm khách
              </Button>
            </>
        </div>

        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-[13px] text-muted-foreground">
                <tr className="border-t border-line">
                  <th className="px-[22px] py-2.5 font-medium">Tên khách</th>
                  <th className="px-3 py-2.5 font-medium">Bên</th>
                  <th className="px-3 py-2.5 font-medium">Nhóm</th>
                  <th className="px-3 py-2.5 text-center font-medium">Số người</th>
                  <th className="px-3 py-2.5 text-center font-medium">Đã mời</th>
                  <th className="px-3 py-2.5 font-medium">Phản hồi</th>
                  <th className="px-[22px] py-2.5" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.id} className="border-t border-line">
                    <td className="px-[22px] py-2.5 font-medium">{g.fullName}</td>
                    <td className="px-3 py-2.5">{SIDE_LABEL[g.side]}</td>
                    <td className="px-3 py-2.5">{g.group}</td>
                    <td className="px-3 py-2.5 text-center">{g.partySize}</td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Đã mời ${g.fullName}`}
                        checked={g.isInvited}
                        onChange={() => update.mutate({ id: g.id, patch: { isInvited: !g.isInvited } })}
                        className="size-[18px] cursor-pointer accent-sage"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Phản hồi của ${g.fullName}`}
                        value={g.rsvp}
                        disabled={!g.isInvited}
                        title={!g.isInvited ? 'Đánh dấu đã mời trước khi chọn phản hồi' : undefined}
                        onChange={(e) => update.mutate({ id: g.id, patch: { rsvp: e.target.value as GuestRsvp } })}
                        className={cn(
                          'rounded-sm border border-input bg-surface px-2 py-1.5 text-[13px] disabled:opacity-60',
                          g.rsvp === 'ATTENDING' && 'text-sage',
                          g.rsvp === 'DECLINED' && 'text-warn',
                        )}
                      >
                        {(Object.keys(RSVP_LABEL) as GuestRsvp[]).map((r) => (
                          <option key={r} value={r}>
                            {RSVP_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-[22px] py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Sửa ${g.fullName}`} onClick={() => setEditing(g)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Xóa ${g.fullName}`} disabled={remove.isPending} onClick={() => removeGuest(g)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-t border-line px-[22px] py-6 text-center text-sm text-muted-foreground">
            {items.length ? 'Không có khách nào khớp bộ lọc.' : 'Chưa có khách nào. Thêm từng khách, dán nhiều tên một lúc hoặc nhập từ Excel.'}
          </p>
        )}
      </section>

      <GuestFormDialog open={editing !== null} guest={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <BulkGuestsDialog open={bulk} onClose={() => setBulk(false)} />
      <ImportDialog type="guests" open={importing} onOpenChange={setImporting} />
    </>
  )
}
