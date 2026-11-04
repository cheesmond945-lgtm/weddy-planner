import { AlertTriangle, Info, LoaderCircle, Lock, LockOpen, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Budget } from '@/types/wedding'
import {
  displayMoney,
  excludeCategory,
  includeCategory,
  parsePercent,
  ratioFromAmount,
  ratioText,
  rebalance,
  resetToBase,
  setLock,
  TOTAL,
  trimToMax,
  type SplitState,
} from '../budgetSplit'
import { type SplitRowView, type SplitView } from '../budgetSplitView'
import { useBudgetMutations, useSaveWedding, useWedding } from '../hooks'
import { PRESET_LABEL } from '../presets'
import type { useBudgetSplit } from '../useBudgetSplit'
import { BudgetPresetPicker } from './BudgetPresetPicker'

/** Tiền hiển thị ở tab Ngân sách: làm tròn 10.000đ (backend giữ số chính xác) */
const money = (x: number) => formatMoney(displayMoney(x))
const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())

/** Slug hạng mục trung tâm tiệc (backend: VENUE_SLUG trong allocation.config.ts) */
const VENUE_SLUG = 'nha-hang'

const MSG = {
  max: (ratio: number) => `Tỷ lệ tối đa có thể đặt cho hạng mục này là ${ratioText(ratio)}%.`,
  lastUnlocked: 'Cần giữ ít nhất một hạng mục mở khóa để hệ thống cân đối tỷ lệ.',
  zero: 'Hạng mục này đang ở 0%, sẽ không có ngân sách gợi ý.',
  unlocked: (name: string) => `Hạng mục ${name} đã được mở khóa để cân đối tỷ lệ vì một hạng mục đã chuyển sang tự lo.`,
  noFund: 'Ngân sách hiện tại chưa đủ cho phần dịch vụ còn lại.',
  noVenue: 'Chưa có gói tiệc phù hợp, tiền tiệc chưa được trừ.',
  invalid: 'Giá trị nhập không hợp lệ.',
  negative: 'Tỷ lệ không được âm, đã đưa về 0%.',
  capMax: (fund: number) => `Giá trần tối đa là ${money(fund)}.`,
  overMax: (name: string, max: number) => `Đã dừng ở giá gói đắt nhất của ${name} (${money(max)}), chia thêm cũng không dùng được.`,
}

type Split = ReturnType<typeof useBudgetSplit>

/**
 * Phần chia ngân sách cho dịch vụ (tài liệu "Luồng Tùy chỉnh ngân sách" v1.2, mục 3–7):
 * quỹ dịch vụ (ⓘ chi tiết), dòng Tiệc chỉ đọc, mỗi hạng mục một thanh "% quỹ" kèm số tiền, vạch giá gói cao nhất.
 * Phương án có sẵn: chỉ xem. Tùy chỉnh: kéo / nhập % / nhập số tiền, khóa, "Tự lo" (bỏ khỏi phần chia), giá trần; tự lưu.
 */
export function BudgetSplitPanel({
  b,
  split,
  view,
  fundNotice,
  onTouch,
  panelRef,
  surplus,
}: {
  b: Budget
  split: Split
  view: SplitView
  /** "Quỹ dịch vụ vừa thay đổi vì …" (ẩn sau 8 giây hoặc khi khách thao tác) */
  fundNotice: string | null
  /** Khách chạm vào thanh / ô nhập: ẩn thông báo quỹ đổi */
  onTouch: () => void
  panelRef?: Ref<HTMLElement>
  /** Quỹ đủ cho gói đắt nhất của mọi dịch vụ (presetsLocked, tính ở trang): ẩn ba mức và Tùy chỉnh */
  surplus: boolean
}) {
  const { settings } = useBudgetMutations()
  const [cost, setCost] = useState<number | null>(null)
  const st = split.draft
  const custom = view.custom && !!st
  const sb = b.fund.serviceBudget
  const hasVenue = b.categories.some((c) => c.kind === 'VENUE')
  const wedding = useWedding().data
  const save = useSaveWedding()
  // "Thêm trung tâm tiệc": thêm hạng mục tiệc vào "Dịch vụ muốn sử dụng" (giữ nguyên các thông tin khác, không gửi mức chia / giờ chính)
  const addVenue = () => {
    if (!wedding) return
    const { groomName, brideName, date, ward, guestCount, budget, categorySlugs, version } = wedding
    save.mutate(
      { groomName, brideName, date, ward, guestCount, budget, categorySlugs: [...new Set([...categorySlugs, VENUE_SLUG])], version },
      { onSuccess: () => toast('Đã thêm trung tâm tiệc vào kế hoạch'), onError: (e) => toast(e.message) },
    )
  }
  const nameOf = (id: string) => b.categories.find((c) => c.categoryId === id)?.name ?? ''

  // Một thao tác của khách trên cấu hình Tùy chỉnh
  const edit = (next: SplitState, save = true) => {
    onTouch()
    split.update(next, save)
  }
  const setRatio = (id: string, wanted: number, save: boolean) => {
    if (!st) return
    // Không cho chia quá giá gói đắt nhất khi còn dịch vụ khác nhận được phần đó (tiền vượt gói đắt nhất không mua được gì).
    // Mọi dịch vụ khác đều đã đủ (quỹ dư) thì vẫn cho, phần vượt tính vào "Còn dư".
    const marker = view.rows.find((x) => x.item.id === id)?.marker ?? null
    const markerOf = (x: string) => view.rows.find((v) => v.item.id === x)?.marker ?? null
    const room = st.items.some((c) => c.id !== id && !c.locked && (markerOf(c.id) === null || c.ratio < markerOf(c.id)!))
    if (marker !== null && wanted > marker && room) {
      if (save) toast(MSG.overMax(nameOf(id), b.categories.find((c) => c.categoryId === id)?.maxPackagePrice ?? 0))
      wanted = marker
    }
    const r = rebalance(st.items, id, wanted)
    if (r.clamped && save) toast(MSG.max(r.max))
    edit({ ...st, items: r.items }, save)
  }
  const exclude = (id: string) => {
    if (!st) return
    const r = excludeCategory(st, id)
    if (r.unlocked) toast(MSG.unlocked(nameOf(r.unlocked)), 6000)
    edit(r.state)
  }
  const include = (id: string) => {
    const e = b.split.eligible.find((x) => x.categoryId === id)
    if (!st || !e) return
    const group = [...view.group, { id, slug: e.slug, median: e.median }]
    edit(includeCategory(st, { id, slug: e.slug, median: e.median }, group))
  }
  const lock = (id: string, value: boolean) => {
    if (!st) return
    const r = setLock(st.items, id, value)
    if (r.error) return toast(MSG.lastUnlocked)
    if (r.zero) toast(MSG.zero, { action: { label: 'Tự lo', onClick: () => exclude(id) } })
    edit({ ...st, items: r.items })
  }

  const single = view.rows.length === 1
  const unlockedCount = view.rows.filter((r) => !r.item.locked).length
  // Quỹ dư (tính ở trang, dùng chung với bảng): ẩn ba mức và Tùy chỉnh, mỗi dịch vụ một dòng "tối đa = gói đắt nhất"
  const presetLocked = surplus
  // Tùy chỉnh mà mọi dịch vụ đều vượt gói đắt nhất: một dòng chung thay cho cảnh báo từng dòng
  const allWarn = view.rows.length > 1 && view.rows.every((r) => r.warn)
  // Một nút chung thay cho nút "Về mức gói cao nhất" ở từng dòng: chỉ hiện khi còn dịch vụ dưới vạch để nhận phần thừa
  const trimmed = custom && st ? trimToMax(st.items, Object.fromEntries(view.rows.map((r) => [r.item.id, r.marker]))) : null
  const canTrim = !!trimmed && trimmed.some((c, i) => c.ratio !== st!.items[i].ratio)
  const overCount = view.rows.filter((r) => r.warn).length
  const openingCustom = settings.isPending && settings.variables?.budgetPreset === 'CUSTOM'

  return (
    <section ref={panelRef} className="mb-5 flex flex-col gap-4 rounded-lg border border-line bg-surface px-[22px] py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {presetLocked ? (
            <h2 className="leading-tight">Mức chia ngân sách</h2>
          ) : (
            <BudgetPresetPicker
              value={b.preset}
              disabled={settings.isPending}
              hint={false}
              optional={false}
              onChange={(budgetPreset) => {
                split.flush()
                settings.mutate({ budgetPreset }, { onSuccess: () => toast(`Đã chuyển sang mức chia ${PRESET_LABEL[budgetPreset]}`) })
              }}
            />
          )}
        </div>
        <div className={cn('flex flex-col items-end gap-1.5', surplus && 'hidden')}>
          {/* Vào Tùy chỉnh mất vài giây (backend tính lại cả bảng): nút quay vòng và đổi chữ để khách biết đang xử lý */}
          <Button
            variant={custom || openingCustom ? 'default' : 'outline'}
            size="sm"
            disabled={settings.isPending || custom}
            aria-busy={openingCustom}
            onClick={() => settings.mutate({ budgetPreset: 'CUSTOM' }, { onSuccess: () => toast('Đã chuyển sang Tùy chỉnh. Kéo hoặc nhập % cho từng dịch vụ bên dưới.') })}
          >
            {openingCustom ? <LoaderCircle className="animate-spin" /> : <SlidersHorizontal />}
            {custom ? 'Đang Tùy chỉnh' : openingCustom ? 'Đang mở Tùy chỉnh…' : 'Tùy chỉnh'}
          </Button>
          {custom ? (
            <>
              <span className="text-[12px] text-muted-foreground">Đang dùng tỷ lệ của bạn</span>
              <SaveStatus status={split.status} />
            </>
          ) : (
            settings.isPending && !openingCustom && <span className="text-[12px] text-muted-foreground">Đang đổi mức chia…</span>
          )}
        </div>
      </div>

      <FundArea
        b={b}
        spend={sb > 0 && view.rows.length > 0 ? { max: view.spendMax, rest: view.unspent } : null}
        fundNotice={fundNotice}
        busy={save.isPending || settings.isPending || !wedding}
        onAddVenue={addVenue}
        onOwnVenue={() => settings.mutate({ ownVenue: true }, { onSuccess: () => toast('Đã chuyển sang tự lo tiệc. Nhập chi phí tự lo ở cuối khung này.') })}
      />

      {view.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bạn đang tự lo mọi dịch vụ, không còn gì để chia.{view.leftover > 0 && ` Còn dư ${money(view.leftover)}.`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <SpendSummary
            sb={sb}
            presetLocked={presetLocked}
            keptCustom={surplus && !!st}
            allWarn={custom && allWarn}
            trim={canTrim ? { count: overCount, apply: () => edit({ ...st!, items: trimmed! }) } : null}
          />
          {presetLocked ? (
            <SpendList view={view} />
          ) : (
            view.rows.map((r) => (
              <SplitRow
                key={r.item.id}
                r={r}
                sb={sb}
                editable={custom}
                quietWarn={allWarn}
                single={single}
                onlyUnlocked={!single && !r.item.locked && unlockedCount === 1}
                onDrag={(ratio) => setRatio(r.item.id, ratio, false)}
                onCommit={() => (onTouch(), split.commit())}
                onRatio={(ratio) => setRatio(r.item.id, ratio, true)}
                onLock={(v) => lock(r.item.id, v)}
                onExclude={() => exclude(r.item.id)}
              />
            ))
          )}
          {single && custom && st && <CapRow st={st} sb={sb} leftover={view.leftover} onCap={(capAmount) => edit({ ...st, capAmount })} />}
        </div>
      )}

      {st && view.excluded.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          <span className="text-[13px] font-medium text-muted-foreground">Tự lo (không chia tiền, không gợi ý gói)</span>
          {view.excluded.map((c) => (
            <div key={c.categoryId} className="flex items-center justify-between gap-3">
              <span>{c.name}</span>
              <Button variant="outline" size="sm" onClick={() => include(c.categoryId)}>
                Thêm lại
              </Button>
            </div>
          ))}
        </div>
      )}

      {custom && st && view.rows.length > 1 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => edit(resetToBase(st, view.group))}>
            <RotateCcw />
            Đặt lại theo phương án nền ({PRESET_LABEL[st.baseMode]})
          </Button>
        </div>
      )}

      {(hasVenue || b.ownVenue) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={b.ownVenue}
              disabled={settings.isPending}
              onChange={(e) => settings.mutate({ ownVenue: e.target.checked })}
              className="size-4 accent-[var(--gold-700)]"
            />
            Tự lo tiệc ngoài nền tảng
          </label>
          {b.ownVenue && (
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              Chi phí tự lo (không bắt buộc)
              <MoneyInput
                aria-label="Chi phí tiệc tự lo"
                value={cost ?? b.ownVenueCost ?? 0}
                onChange={setCost}
                onBlur={() => {
                  if (cost !== null && cost !== (b.ownVenueCost ?? 0)) settings.mutate({ ownVenueCost: cost || null })
                  setCost(null)
                }}
                className="w-[160px] px-2.5 py-1.5 text-right text-sm text-ink"
              />
            </label>
          )}
        </div>
      )}
    </section>
  )
}

function SaveStatus({ status }: { status: Split['status'] }) {
  if (status === 'idle') return null
  const text = { saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Chưa lưu được' }[status]
  return (
    <span role="status" className={cn('text-[12px]', status === 'error' ? 'text-warn' : 'text-muted-foreground')}>
      {text}
    </span>
  )
}

/** Dòng "Quỹ dịch vụ: X" (ⓘ chi tiết), dòng Tiệc chỉ đọc, cảnh báo quỹ và thông báo quỹ đổi */
function FundArea({
  b,
  fundNotice,
  busy,
  onAddVenue,
  onOwnVenue,
  spend,
}: {
  b: Budget
  /** Dự kiến chi tối đa / Còn dư của nhóm chia (null: quỹ ≤ 0 hoặc không còn dịch vụ trong phần chia) */
  spend: { max: number; rest: number } | null
  fundNotice: string | null
  busy: boolean
  onAddVenue: () => void
  onOwnVenue: () => void
}) {
  const [open, setOpen] = useState(false)
  const f = b.fund
  const v = f.venue
  const details: [string, number, string?][] = [
    ['Tổng ngân sách', f.totalBudget],
    ['Đã chọn', -f.selectedCost, v.status === 'CHOSEN' ? 'gồm tiệc đã chọn' : undefined],
    ['Tiền cọc đã mất', -f.lostDeposit],
    ...(v.status === 'OWN' ? ([['Tiệc tự lo', -f.selfVenueCost]] as [string, number][]) : []),
    ...(v.status === 'SUGGESTED' ? ([['Gói tiệc đề xuất', -(v.amount ?? 0)]] as [string, number][]) : []),
    ['Chi phí ngoài nền tảng', -f.externalCost],
  ]
  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-4 text-sm">
      {/*
        Quỹ dịch vụ là một thanh chỉ đọc (không núm kéo, khác màu các thanh kéo bên dưới): phần đậm là chi tối đa theo giá gói đắt nhất,
        phần sọc là còn dư (tiền không gói nào tiêu hết). Quỹ vừa sát (còn dư < 2% quỹ) thì chỉ ghi chữ, không vẽ thanh.
        Tiệc đã chọn / đã cọc đã có ở 4 thẻ đầu trang nên không nhắc lại; chỉ ghi khi tiệc là gói đề xuất (đã trừ khỏi quỹ).
      */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            Quỹ dịch vụ <strong className="text-[17px] tabular-nums">{money(f.serviceBudget)}</strong>
            <button
              type="button"
              aria-expanded={open}
              aria-label="Chi tiết quỹ dịch vụ"
              onClick={() => setOpen((x) => !x)}
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-accent-soft hover:text-gold-700"
            >
              <Info className="size-4" />
            </button>
          </span>
          {v.status === 'SUGGESTED' && (
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              {v.amount === null ? 'Chưa có gói tiệc phù hợp' : `Đã trừ gói tiệc đề xuất ${money(v.amount)}`}
              {v.overBy !== null && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">Vượt {money(v.overBy)}</span>}
            </span>
          )}
        </div>
        {spend && f.serviceBudget > 0 && spend.rest >= f.serviceBudget * 0.02 && (
          <div className="fund-track" role="img" aria-label={`Chi tối đa ${money(spend.max)}, còn dư ${money(spend.rest)} trên quỹ ${money(f.serviceBudget)}`}>
            <i style={{ width: `${Math.min(100, (spend.max / f.serviceBudget) * 100)}%` }} />
          </div>
        )}
        {spend && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="fund-dot fund-dot--spend" aria-hidden />
              Chi tối đa theo giá gói đắt nhất <strong className="text-ink tabular-nums">{money(spend.max)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="fund-dot fund-dot--rest" aria-hidden />
              Còn dư <strong className="text-ink tabular-nums">{money(spend.rest)}</strong>
            </span>
          </p>
        )}
      </div>
      {open && (
        <dl className="grid max-w-[460px] grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[13px]">
          {details.map(([label, value, hint]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">
                {label}
                {hint && <span className="ml-1 text-[12px]">({hint})</span>}
              </dt>
              <dd className="text-right tabular-nums">{value < 0 ? `− ${money(-value)}` : money(value)}</dd>
            </div>
          ))}
          <p className="col-span-full pb-1 text-[12px] text-muted-foreground">Tỷ lệ ở các thanh là % của quỹ này, không phải của tổng ngân sách.</p>
          <dt className="border-t border-line pt-1 font-medium">Quỹ dịch vụ</dt>
          <dd className="border-t border-line pt-1 text-right font-medium tabular-nums">≈ {money(f.serviceBudget)}</dd>
        </dl>
      )}
      {v.status === 'NO_PACKAGE' && <Warn>{MSG.noVenue}</Warn>}
      {/* Kế hoạch không có trung tâm tiệc: quỹ không trừ tiệc nên to bất thường, nói rõ lý do và cho cách sửa ngay */}
      {v.status === 'NONE' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
          <span className="flex items-start gap-1.5 text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
            Kế hoạch chưa có trung tâm tiệc nên quỹ dịch vụ đang gồm cả phần thường dành cho tiệc.
          </span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={onAddVenue}>
              Thêm trung tâm tiệc
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onOwnVenue}>
              Tự lo tiệc
            </Button>
          </span>
        </div>
      )}
      {f.serviceBudgetRaw <= 0 && <Warn>{MSG.noFund} Tỷ lệ vẫn chỉnh được, ô nhập số tiền tạm tắt.</Warn>}
      {fundNotice && (
        <p role="status" className="text-[12px] font-medium text-gold-700">
          {fundNotice}
        </p>
      )}
    </div>
  )
}

/**
 * Số tổng khách cần nhất: "Dự kiến chi tối đa / Còn dư" (mỗi hạng mục tiêu tối đa đến giá gói đắt nhất), in to.
 * Ba mức có sẵn không ảnh hưởng gợi ý: hộp thông báo (tông xanh, khác thẻ chọn) chỉ cách giới hạn chi bằng Tùy chỉnh.
 * Tùy chỉnh mà mọi dịch vụ đều vượt gói đắt nhất: một dòng chung thay cho cảnh báo từng dòng.
 */
function SpendSummary({
  sb,
  presetLocked,
  keptCustom,
  allWarn,
  trim,
}: {
  sb: number
  presetLocked: boolean
  /** Khách đang ở Tùy chỉnh: tỷ lệ đã đặt vẫn giữ, dùng lại khi quỹ hết dư */
  keptCustom: boolean
  allWarn: boolean
  /** Có dịch vụ vượt gói đắt nhất và còn dịch vụ khác nhận được phần thừa */
  trim: { count: number; apply: () => void } | null
}) {
  if (!(sb > 0)) return null
  // Khi ba mức có sẵn bị khóa: một dòng hướng dẫn dùng Tùy chỉnh (hộp tím nhạt); Tùy chỉnh: một dòng chung về phần thừa
  return (
    <div className="flex flex-col gap-2.5">
      {presetLocked && (
        <p role="status" className="budget-note flex items-start gap-2 text-[13px]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Quỹ đủ cho gói đắt nhất của mọi dịch vụ nên không cần chia. Muốn tiết kiệm, chọn gói rẻ hơn ở bảng bên dưới hoặc giảm tổng ngân sách.
            {keptCustom && ' Tỷ lệ Tùy chỉnh của bạn vẫn được giữ, sẽ dùng lại khi quỹ không còn dư.'}
          </span>
        </p>
      )}
      {allWarn && <Warn>Mọi dịch vụ đều đang được chia nhiều hơn gói đắt nhất, phần thừa đã tính vào "Còn dư".</Warn>}
      {trim && !allWarn && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Warn>{trim.count} dịch vụ đang được chia nhiều hơn gói đắt nhất.</Warn>
          <Button variant="outline" size="sm" onClick={trim.apply}>
            Chuyển phần thừa sang dịch vụ khác
          </Button>
        </div>
      )}
    </div>
  )
}

/** Quỹ dư: mỗi dịch vụ một dòng, mức chi tối đa = giá gói đắt nhất (không có thanh kéo) */
function SpendList({ view }: { view: SplitView }) {
  const spend = view.rows.map((r) => Math.min(r.amount, r.category.maxPackagePrice ?? r.amount))
  const top = Math.max(1, ...spend)
  // Mỗi dịch vụ một màu pastel (budget-theme.css .budget-spend), thanh dài theo mức chi so với dịch vụ chi nhiều nhất
  return (
    <ul className="budget-spend flex flex-col gap-1.5 text-sm">
      {view.rows.map((r, i) => (
        <li
          key={r.item.id}
          className="grid grid-cols-[minmax(96px,150px)_1fr_auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2 max-sm:grid-cols-[1fr_auto]"
        >
          <span className="flex items-center gap-2 font-medium">
            <i className="budget-dot" aria-hidden />
            {r.category.name}
          </span>
          <span className="budget-bar max-sm:order-last max-sm:col-span-2" aria-hidden>
            <i style={{ width: `${(spend[i] / top) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">
            <span className="font-medium">{money(spend[i])}</span>
            <span className="ml-1.5 text-[12px] text-muted-foreground">{r.warn ? 'gói đắt nhất' : 'theo mức chia'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] text-warn">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/**
 * Một hạng mục trong nhóm chia: thanh kéo (đơn vị 0,01%) có vạch giá gói cao nhất, ô "% quỹ", ô số tiền, nút khóa, "Tự lo";
 * dưới thanh là cảnh báo khi tiền vượt giá gói cao nhất (nút chung "Chuyển phần thừa sang dịch vụ khác" nằm ở SpendSummary).
 */
function SplitRow({
  r,
  sb,
  editable,
  quietWarn,
  single,
  onlyUnlocked,
  onDrag,
  onCommit,
  onRatio,
  onLock,
  onExclude,
}: {
  r: SplitRowView
  sb: number
  editable: boolean
  /** Mọi dịch vụ đều vượt gói đắt nhất: không cảnh báo từng dòng (đã có dòng chung) */
  quietWarn: boolean
  single: boolean
  onlyUnlocked: boolean
  onDrag: (ratio: number) => void
  onCommit: () => void
  onRatio: (ratio: number) => void
  onLock: (value: boolean) => void
  onExclude: () => void
}) {
  const [pct, setPct] = useState<string | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const { item, category } = r
  const name = category.name
  const fixed = !editable || single || item.locked || onlyUnlocked
  const showMarker = r.marker !== null && r.marker < TOTAL

  const commitPct = () => {
    const text = pct
    setPct(null)
    if (text === null) return
    const p = parsePercent(text)
    if (p.kind === 'empty') return
    if (p.kind === 'invalid') return toast(MSG.invalid)
    if (p.negative) toast(MSG.negative)
    if (p.ratio !== item.ratio || p.negative) onRatio(p.ratio)
  }
  const commitAmount = () => {
    const a = amount
    setAmount(null)
    if (a === null) return
    const wanted = ratioFromAmount(a, sb)
    if (wanted !== null) onRatio(wanted)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[140px_1fr_118px_150px_auto] items-center gap-3 text-sm max-[760px]:grid-cols-[1fr_110px_130px]">
        <span className={cn('inline-flex items-center gap-1.5 font-medium max-[760px]:col-span-3', item.locked && 'text-muted-foreground')}>
          {item.locked && <Lock className="size-3.5" aria-hidden />}
          {name}
        </span>
        <div className="relative max-[760px]:col-span-3">
          <input
            type="range"
            min={0}
            max={TOTAL}
            step={1}
            value={item.ratio}
            disabled={fixed}
            onChange={(e) => onDrag(Number(e.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            aria-label={`Tỷ lệ ${name} (% quỹ)`}
            className="w-full accent-[var(--gold-700)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          {showMarker && (
            <span
              aria-hidden
              title={`Giá gói cao nhất: ${money(category.maxPackagePrice ?? 0)}`}
              className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-warn"
              style={{ left: `calc(${(r.marker! / TOTAL) * 100}% - 1px)` }}
            />
          )}
        </div>
        <label className="flex items-center gap-1 rounded-sm border border-input bg-surface px-2 py-1.5 focus-within:border-ring">
          <input
            inputMode="decimal"
            aria-label={`Tỷ lệ % quỹ ${name}`}
            value={pct ?? ratioText(item.ratio)}
            disabled={fixed}
            onFocus={() => setPct(ratioText(item.ratio))}
            onChange={(e) => setPct(e.target.value)}
            onBlur={commitPct}
            onKeyDown={blurOnEnter}
            className="w-full min-w-0 border-0 bg-transparent text-right text-sm tabular-nums outline-none disabled:text-muted-foreground"
          />
          <span className="text-[12px] whitespace-nowrap text-muted-foreground">% quỹ</span>
        </label>
        <MoneyInput
          aria-label={`Số tiền ${name}`}
          value={amount ?? displayMoney(r.amount)}
          disabled={fixed || sb <= 0}
          onChange={setAmount}
          onBlur={commitAmount}
          onKeyDown={blurOnEnter}
          className="px-2.5 py-1.5 text-right text-sm tabular-nums disabled:opacity-60"
        />
        {editable ? (
          <div className="flex items-center gap-1 max-[760px]:col-span-3 max-[760px]:justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={single || onlyUnlocked}
              aria-label={item.locked ? `Mở khóa ${name}` : `Khóa ${name}`}
              title={single ? 'Chỉ còn một hạng mục' : onlyUnlocked ? MSG.lastUnlocked : item.locked ? 'Mở khóa' : 'Khóa tỷ lệ'}
              onClick={() => onLock(!item.locked)}
            >
              {item.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[12px] text-muted-foreground"
              title="Bạn tự lo dịch vụ này: không chia tiền, không gợi ý gói; phần tiền của nó chia lại cho các dịch vụ khác. Thêm lại được bất cứ lúc nào."
              onClick={onExclude}
            >
              Tự lo
            </Button>
          </div>
        ) : (
          <span className="max-[760px]:hidden" />
        )}
      </div>
      {r.warn && (
        <div className={cn('flex flex-wrap items-center gap-2 pl-[152px] text-[12px] max-[760px]:pl-0', quietWarn ? 'text-muted-foreground' : 'text-warn')}>
          {quietWarn ? (
            <span>Gói đắt nhất {money(category.maxPackagePrice ?? 0)}.</span>
          ) : (
            <>
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              <span>
                Gói đắt nhất {money(category.maxPackagePrice ?? 0)}, thừa khoảng {money(r.unused)}.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Nhóm chỉ còn một hạng mục: ô "Giá trần" (để trống là không đặt trần) và "Còn dư" */
function CapRow({ st, sb, leftover, onCap }: { st: SplitState; sb: number; leftover: number; onCap: (cap: number | null) => void }) {
  const [draft, setDraft] = useState<number | null>(null)
  const commit = () => {
    const v = draft
    setDraft(null)
    if (v === null) return
    if (!v) return st.capAmount !== null && onCap(null)
    if (v > sb) {
      toast(MSG.capMax(sb))
      return onCap(Math.max(0, Math.floor(sb)))
    }
    if (v !== st.capAmount) onCap(v)
  }
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
      <label className="inline-flex items-center gap-2">
        Giá trần
        <MoneyInput
          aria-label="Giá trần"
          placeholder="Không đặt trần"
          value={draft ?? st.capAmount ?? 0}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          className="w-[170px] px-2.5 py-1.5 text-right text-sm"
        />
      </label>
      <span className="text-muted-foreground">
        Còn dư: <strong className="text-ink tabular-nums">{money(leftover)}</strong>
      </span>
    </div>
  )
}
