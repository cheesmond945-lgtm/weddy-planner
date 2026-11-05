import { AlertTriangle, ChevronDown, Info, LoaderCircle, Lock, LockOpen, PiggyBank, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Budget } from '@/types/wedding'
import {
  clampToMax,
  DISPLAY_ROUND_UNIT,
  displayMoney,
  parsePercent,
  ratioFromAmount,
  ratioText,
  resetToBase,
  setLock,
  setReserve,
  setServiceRatio,
  TOTAL,
  type SplitItem,
  type SplitState,
} from '../budgetSplit'
import { presetItemsOf, presetsSame, type SplitRowView, type SplitView } from '../budgetSplitView'
import { useBudgetMutations, useSaveWedding, useWedding } from '../hooks'
import { useOwnService } from '../useOwnService'
import { PRESET_LABEL } from '../presets'
import type { useBudgetSplit } from '../useBudgetSplit'
import { BudgetPresetPicker, presetCardClass } from './BudgetPresetPicker'

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
  reserveMin: (ratio: number) => `Mọi dịch vụ đã đủ gói đắt nhất, Dự phòng còn ít nhất ${ratioText(ratio)}%.`,
}

type Split = ReturnType<typeof useBudgetSplit>

/**
 * Lưới chung của các dòng chia (dịch vụ và Dự phòng): tên, thanh kéo, ô % quỹ, ô số tiền, cột nút. Cột nút rộng cố định để dòng
 * không có nút (Dự phòng, mức có sẵn) vẫn thẳng cột với dòng có nút khóa / Tự lo.
 */
const ROW_GRID = 'grid grid-cols-[140px_1fr_118px_150px_96px] items-center gap-3 text-sm max-[760px]:grid-cols-[1fr_110px_130px] max-[480px]:grid-cols-2 max-[480px]:gap-x-2.5'

/**
 * Phần chia ngân sách cho dịch vụ (tài liệu "Luồng Tùy chỉnh ngân sách" v1.2, mục 3–7):
 * quỹ dịch vụ (ⓘ chi tiết), dòng Tiệc chỉ đọc, mỗi hạng mục một thanh "% quỹ" kèm số tiền, vạch giá gói cao nhất.
 * Phương án có sẵn: chỉ xem. Tùy chỉnh: kéo / nhập % / nhập số tiền, khóa, giá trần; tự lưu. Tự lo thao tác ở bảng Theo hạng mục (useOwnService).
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
  /** "Quỹ chưa phân bổ vừa thay đổi vì …" (ẩn sau 8 giây hoặc khi khách thao tác) */
  fundNotice: string | null
  /** Khách chạm vào thanh / ô nhập: ẩn thông báo quỹ đổi */
  onTouch: () => void
  panelRef?: Ref<HTMLElement>
  /** Quỹ đủ cho gói đắt nhất của mọi dịch vụ (presetsLocked, tính ở trang): ẩn ba mức và Tùy chỉnh */
  surplus: boolean
}) {
  const { settings } = useBudgetMutations()
  const [cost, setCost] = useState<number | null>(null)
  // Thu gọn khung (chỉ còn một dòng tóm tắt): tự thu gọn khi không còn dịch vụ nào để chia, tự mở lại khi có; khách bấm nút để đổi
  const empty = view.rows.length === 0
  const [collapsed, setCollapsed] = useState(empty)
  const wasEmpty = useRef(empty)
  useEffect(() => {
    if (wasEmpty.current !== empty) setCollapsed(empty)
    wasEmpty.current = empty
  }, [empty])
  const st = split.draft
  const custom = view.custom && !!st
  const sb = b.fund.serviceBudget
  // Tên hạng mục tiệc cho dòng "Tự lo" (kế hoạch không có hạng mục tiệc mà vẫn tự lo thì ghi chung)
  const venueName = b.categories.find((c) => c.kind === 'VENUE')?.name ?? 'Tiệc cưới'
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

  // Một thao tác của khách trên cấu hình Tùy chỉnh: chỉ đổi bản nháp, bấm "Lưu" mới gửi
  const edit = (next: SplitState) => {
    onTouch()
    split.update(next)
  }
  const markers = Object.fromEntries(view.rows.map((x) => [x.item.id, x.marker]))
  // Kéo / nhập một dịch vụ: không quá gói đắt nhất (tiền vượt không mua được gì); giảm thì vào Dự phòng, tăng thì lấy Dự phòng trước
  const setRatio = (id: string, wanted: number, save: boolean) => {
    if (!st) return
    const r = setServiceRatio(st.items, id, wanted, markers)
    if (save && r.limit === 'MARKER') toast(MSG.overMax(nameOf(id), b.categories.find((c) => c.categoryId === id)?.maxPackagePrice ?? 0))
    if (save && r.limit === 'SHARE') toast(MSG.max(r.max))
    edit({ ...st, items: r.items })
  }
  const setReserveRatio = (wanted: number, save: boolean) => {
    if (!st) return
    const r = setReserve(st.items, wanted, markers)
    if (save && r.limited) toast(MSG.reserveMin(r.reserve))
    edit({ ...st, items: r.items })
  }
  // Tự lo thao tác ở bảng Theo hạng mục; ở đây chỉ dùng cho nút trong thông báo khi kéo một dịch vụ về 0%
  const { exclude } = useOwnService({ b, split, view, onTouch })
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
  // Ba mức cho cùng số tiền (quỹ gần đủ cho gói đắt nhất): ẩn ba thẻ nhưng vẫn cho Tùy chỉnh. Đang Tùy chỉnh thì vẫn hiện để quay lại.
  const same = !surplus && !custom && presetsSame(b)
  const many = custom && !!st && view.rows.length > 1
  // Tùy chỉnh mà quỹ lớn hơn tổng giá gói đắt nhất: một dòng thông tin chung. `spare` là phần thừa tối thiểu (nằm ở Dự phòng).
  const roomy = many && view.surplus
  const spare = roomy ? sb - view.rows.reduce((t, r) => t + (r.category.maxPackagePrice ?? 0), 0) : 0
  const changed = (xs: SplitItem[]) => xs.some((c, i) => c.ratio !== st!.items[i].ratio)
  // Dịch vụ đang vượt vạch (quỹ tăng làm vạch thấp xuống, hoặc vừa chuyển từ mức có sẵn): đưa về vạch, phần vượt vào Dự phòng
  const clamped = many ? clampToMax(st!.items, markers) : null
  // Quỹ dư: mọi dịch vụ đúng gói đắt nhất, phần còn lại ở Dự phòng
  const filled = roomy && clamped ? setReserve(clamped, 0, markers).items : null
  const openingCustom = settings.isPending && settings.variables?.budgetPreset === 'CUSTOM'

  return (
    <section ref={panelRef} className="relative mb-5 flex flex-col gap-4 rounded-lg border border-line bg-surface px-[22px] py-5">
      {/* Nút thu gọn / mở rộng (chỉ biểu tượng), luôn ở góc trên bên phải */}
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Mở rộng mức chia ngân sách' : 'Thu gọn mức chia ngân sách'}
        title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-3.5 right-3.5 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent-soft hover:text-ink"
      >
        <ChevronDown className={cn('size-[18px] transition-transform', !collapsed && 'rotate-180')} aria-hidden />
      </button>
      {collapsed ? (
        // Thu gọn: một dòng tóm tắt mức chia và quỹ dịch vụ
        <p className="flex flex-wrap items-baseline gap-x-2 pr-10 text-sm text-muted-foreground">
          <b className="font-semibold text-ink">Mức chia ngân sách</b>
          <span>· {b.presetLabel}</span>
          <span>
            · Quỹ chưa phân bổ <b className="font-semibold text-ink tabular-nums">{money(sb)}</b>
          </span>
          {empty && <span>· Mọi dịch vụ đã chọn gói{view.excluded.length > 0 || b.ownVenue ? ' hoặc tự lo' : ''}</span>}
        </p>
      ) : (
      <>
      {/* Thẻ "Tùy chỉnh" (thứ tư, cùng hàng ba mức có sẵn): đang Tùy chỉnh thì sáng và ghi trạng thái lưu ngay trong thẻ.
          Vào Tùy chỉnh mất vài giây (backend tính lại cả bảng): biểu tượng quay vòng, chữ "Đang mở…". */}
      {(() => {
        const open = () => settings.mutate({ budgetPreset: 'CUSTOM' }, { onSuccess: () => toast('Đã chuyển sang Tùy chỉnh. Kéo hoặc nhập % cho từng dịch vụ bên dưới.') })
        const icon = openingCustom ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <SlidersHorizontal className="size-4" aria-hidden />
        const customCard = (
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            aria-busy={openingCustom}
            disabled={settings.isPending || custom}
            onClick={open}
            className={cn(presetCardClass(custom || openingCustom), custom && 'disabled:cursor-default', surplus && 'hidden')}
          >
            <span className={cn('flex items-center gap-1.5 text-sm font-semibold', (custom || openingCustom) && 'text-gold-700')}>
              {icon}
              {openingCustom ? 'Đang mở Tùy chỉnh…' : 'Tùy chỉnh'}
            </span>
            <span className="block text-xs text-muted-foreground">
              {custom ? <SaveStatus status={split.status} unsaved={split.unsaved} idle="Đang dùng tỷ lệ của bạn." /> : 'Tự kéo tỷ lệ cho từng dịch vụ.'}
            </span>
          </button>
        )
        // Không còn hạng mục nào để chia: đổi mức chia không có tác dụng nên ẩn bốn thẻ, chỉ giữ tiêu đề (dòng giải thích ở dưới)
        if (empty) return <h2 className="pr-9 leading-tight">Mức chia ngân sách</h2>
        return presetLocked || same ? (
          // Ba mức bị khóa / giống nhau: chỉ tiêu đề và nút Tùy chỉnh gọn bên phải (chừa chỗ cho nút thu gọn ở góc)
          <div className="flex flex-wrap items-center justify-between gap-3 pr-9">
            <h2 className="leading-tight">Mức chia ngân sách</h2>
            <div className={cn('flex items-center gap-2.5', surplus && 'hidden')}>
              {custom && <SaveStatus status={split.status} unsaved={split.unsaved} />}
              <Button variant={custom || openingCustom ? 'default' : 'outline'} size="sm" disabled={settings.isPending || custom} aria-busy={openingCustom} onClick={open}>
                {icon}
                {custom ? 'Đang Tùy chỉnh' : openingCustom ? 'Đang mở Tùy chỉnh…' : 'Tùy chỉnh'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="pr-9">
            <BudgetPresetPicker
              value={b.preset}
              disabled={settings.isPending}
              hint={false}
              optional={false}
              extra={customCard}
              onChange={(budgetPreset) => {
                split.flush()
                settings.mutate({ budgetPreset }, { onSuccess: () => toast(`Đã chuyển sang mức chia ${PRESET_LABEL[budgetPreset]}`) })
              }}
            />
            {settings.isPending && !openingCustom && <p className="mt-1.5 text-[12px] text-muted-foreground">Đang đổi mức chia…</p>}
          </div>
        )
      })()}

      <FundArea
        b={b}
        spend={sb > 0 && view.rows.length > 0 ? { max: view.spendMax, rest: view.unspent, custom: view.custom } : null}
        fundNotice={fundNotice}
        busy={save.isPending || settings.isPending || !wedding}
        onAddVenue={addVenue}
        onOwnVenue={() => settings.mutate({ ownVenue: true }, { onSuccess: () => toast('Đã chuyển sang tự lo tiệc. Nhập chi phí ở mục Tự lo trong khung này.') })}
      />

      {view.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {/* Không còn dịch vụ nào để chia: thường là đã chọn gói hết (gói đã chọn không nằm trong phần chia), có thể kèm vài dịch vụ tự lo */}
          {view.excluded.length > 0 || b.ownVenue ? 'Mọi dịch vụ đã chọn gói hoặc tự lo' : 'Mọi dịch vụ đã chọn gói'}, không còn gì để chia.{view.leftover > 0 && ` Còn dư ${money(view.leftover)}.`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <SpendSummary
            sb={sb}
            presetLocked={presetLocked}
            same={same}
            keptCustom={surplus && view.custom}
            spare={roomy ? spare : null}
            fill={filled && changed(filled) ? () => edit({ ...st!, items: filled }) : null}
            clamp={!roomy && clamped && changed(clamped) ? () => edit({ ...st!, items: clamped }) : null}
          />
          {/* Tiêu đề khu chia: nhãn nhỏ in hoa thẳng cột với ô % và ô số tiền; "Đặt lại" (Tùy chỉnh) nằm cùng khu nó tác động */}
          {!presetLocked && (
            <div className={cn(ROW_GRID, 'border-b border-line pb-1.5 max-[760px]:hidden')}>
              <span className="budget-eyebrow col-span-2 flex items-center gap-3 text-muted-foreground">
                Chia cho từng dịch vụ
                {custom && st && view.rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Như phương án nền đang thấy: đã cắt về giá gói đắt nhất, hai mức Ưu tiên đã nâng hạng gói
                      const r = resetToBase(st, view.group)
                      edit({ ...r, items: presetItemsOf(view.group, st.baseMode, b) })
                    }}
                    title={`Đặt lại theo phương án nền (${PRESET_LABEL[st.baseMode]})`}
                    className="inline-flex items-center gap-1 rounded-sm text-[11px] font-medium tracking-normal normal-case hover:text-gold-700"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    Đặt lại theo {PRESET_LABEL[st.baseMode]}
                  </button>
                )}
              </span>
              <span className="budget-eyebrow pr-2 text-right text-muted-foreground">% quỹ</span>
              <span className="budget-eyebrow pr-2.5 text-right text-muted-foreground">Số tiền</span>
              <span />
            </div>
          )}
          {presetLocked ? (
            <SpendList view={view} sb={sb} />
          ) : (
            view.rows.map((r) => (
              <SplitRow
                key={r.item.id}
                r={r}
                sb={sb}
                editable={custom}
                single={single}
                onlyUnlocked={!single && !r.item.locked && unlockedCount === 1}
                onDrag={(ratio) => setRatio(r.item.id, ratio, false)}
                onCommit={onTouch}
                onRatio={(ratio) => setRatio(r.item.id, ratio, true)}
                onLock={(v) => lock(r.item.id, v)}
              />
            ))
          )}
          {many && <ReserveRow ratio={view.reserve} amount={view.leftover} sb={sb} onDrag={(x) => setReserveRatio(x, false)} onCommit={onTouch} onRatio={(x) => setReserveRatio(x, true)} />}
          {single && custom && st && <CapRow st={st} sb={sb} leftover={view.leftover} onCap={(capAmount) => edit({ ...st, capAmount })} />}
        </div>
      )}

      {/* Mọi thứ khách tự lo ở một chỗ: tiệc tự lo (chỉ bật được khi kế hoạch không có hạng mục tiệc, nút ở phần quỹ) và dịch vụ bỏ khỏi phần chia */}
      {(view.excluded.length > 0 || b.ownVenue) && (
        <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <span className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="budget-eyebrow text-muted-foreground">Tự lo</span>
            <span className="text-[12px] text-muted-foreground">Không chia tiền, không gợi ý gói</span>
          </span>
          {b.ownVenue && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <span className="flex-1 text-[15px] font-medium text-ink">{venueName}</span>
              <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                Chi phí tự lo
                <MoneyInput
                  aria-label="Chi phí tiệc tự lo"
                  placeholder="Không bắt buộc"
                  value={cost ?? b.ownVenueCost ?? 0}
                  disabled={settings.isPending}
                  onChange={setCost}
                  onBlur={() => {
                    if (cost !== null && cost !== (b.ownVenueCost ?? 0)) settings.mutate({ ownVenueCost: cost || null })
                    setCost(null)
                  }}
                  onKeyDown={blurOnEnter}
                  className="w-[150px] px-2.5 py-1.5 text-right text-sm text-ink"
                />
              </label>
              <Button variant="outline" size="sm" disabled={settings.isPending} onClick={() => settings.mutate({ ownVenue: false, ownVenueCost: null })}>
                Thêm lại
              </Button>
            </div>
          )}
          {view.excluded.length > 0 && (
            <p className="text-[13px] text-ink-2">
              <b className="font-medium text-ink">{view.excluded.map((c) => c.name).join(', ')}</b>
              <span className="text-muted-foreground"> · nhập chi phí dự kiến hoặc thêm lại ở bảng Theo hạng mục bên dưới</span>
            </p>
          )}
          <span className="text-[12px] text-muted-foreground">
            Chi phí tự lo được trừ khỏi quỹ chưa phân bổ.
          </span>
        </div>
      )}

      {/* Thanh lưu dính đáy màn hình khi còn thay đổi chưa lưu: luôn thấy nút Lưu dù đang kéo ở đâu trong khung */}
      {custom && st && (split.unsaved || split.status === 'saving') && (
        <div className="sticky bottom-3 z-20 -mx-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/40 bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 py-2.5 shadow-[0_10px_28px_-12px_rgb(40_30_10/0.35)] backdrop-blur-[6px]">
          <span className="text-[13px] font-medium text-gold-700">{split.status === 'saving' ? 'Đang lưu tỷ lệ…' : 'Bạn có thay đổi chưa lưu'}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={split.status === 'saving'} onClick={split.discard}>
              Hủy
            </Button>
            <Button size="sm" disabled={split.status === 'saving'} onClick={split.save}>
              {split.status === 'saving' ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      )}
      </>
      )}
    </section>
  )
}

/** Trạng thái lưu của Tùy chỉnh; `idle`: chữ hiện khi chưa sửa gì (mặc định không hiện) */
function SaveStatus({ status, unsaved, idle }: { status: Split['status']; unsaved: boolean; idle?: string }) {
  if (unsaved) return <span className="text-[12px] font-medium text-gold-700">Có thay đổi chưa lưu</span>
  if (status === 'idle') return idle ? <span>{idle}</span> : null
  const text = { saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Chưa lưu được' }[status]
  return (
    <span role="status" className={cn('text-[12px]', status === 'error' ? 'text-warn' : 'text-muted-foreground')}>
      {text}
    </span>
  )
}

/** Dòng "Quỹ chưa phân bổ: X" (ⓘ chi tiết), dòng Tiệc chỉ đọc, cảnh báo quỹ và thông báo quỹ đổi */
function FundArea({
  b,
  fundNotice,
  busy,
  onAddVenue,
  onOwnVenue,
  spend,
}: {
  b: Budget
  /** Dự kiến chi tối đa / Còn dư của nhóm chia (null: quỹ ≤ 0 hoặc không còn dịch vụ trong phần chia); custom: chia theo Tùy chỉnh */
  spend: { max: number; rest: number; custom: boolean } | null
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
        Quỹ chưa phân bổ là một thanh chỉ đọc (không núm kéo, khác màu các thanh kéo bên dưới): phần đậm là chi tối đa theo giá gói đắt nhất,
        phần sọc là còn dư (tiền không gói nào tiêu hết). Quỹ vừa sát (còn dư < 2% quỹ) thì chỉ ghi chữ, không vẽ thanh.
        Tiệc đã chọn / đã cọc đã có ở 4 thẻ đầu trang nên không nhắc lại; chỉ ghi khi tiệc là gói đề xuất (đã trừ khỏi quỹ).
      */}
      <div className="flex flex-col gap-2">
        {/* Con số chính của khung: nhãn nhỏ in hoa, số tiền to đậm */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="flex flex-col gap-1">
            <span className="budget-eyebrow text-muted-foreground">Quỹ chưa phân bổ</span>
            <span className="flex items-center gap-2">
              <strong className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">{money(f.serviceBudget)}</strong>
              <button
                type="button"
                aria-expanded={open}
                aria-label="Chi tiết quỹ chưa phân bổ"
                onClick={() => setOpen((x) => !x)}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-accent-soft hover:text-gold-700"
              >
                <Info className="size-4" />
              </button>
            </span>
          </div>
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
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="fund-dot fund-dot--spend" aria-hidden />
              {spend.custom ? 'Chi theo tỷ lệ bạn tự chia' : 'Chi tối đa theo giá gói đắt nhất'} <strong className="text-ink tabular-nums">{money(spend.max)}</strong>
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
          <dt className="border-t border-line pt-1 font-medium">Quỹ chưa phân bổ</dt>
          <dd className="border-t border-line pt-1 text-right font-medium tabular-nums">≈ {money(f.serviceBudget)}</dd>
        </dl>
      )}
      {v.status === 'NO_PACKAGE' && <Warn>{MSG.noVenue}</Warn>}
      {/* Kế hoạch không có trung tâm tiệc: quỹ không trừ tiệc nên to bất thường, nói rõ lý do và cho cách sửa ngay */}
      {v.status === 'NONE' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
          <span className="flex items-start gap-1.5 text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
            Kế hoạch chưa có trung tâm tiệc nên quỹ chưa phân bổ đang gồm cả phần thường dành cho tiệc.
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
 * Ba mức cho cùng kết quả (quỹ gần đủ): hộp thông báo cùng kiểu, Tùy chỉnh vẫn dùng được.
 * Ba mức cho cùng kết quả (quỹ gần đủ): hộp thông báo cùng kiểu, Tùy chỉnh vẫn dùng được.
 * Tùy chỉnh mà quỹ lớn hơn tổng giá gói đắt nhất: một dòng thông tin chung, kèm nút đặt mọi dịch vụ đúng gói đắt nhất nếu chưa.
 * Tùy chỉnh có dịch vụ vượt gói đắt nhất: nút đưa phần vượt vào Dự phòng.
 */
function SpendSummary({
  sb,
  presetLocked,
  same,
  keptCustom,
  spare,
  fill,
  clamp,
}: {
  sb: number
  presetLocked: boolean
  /** Ba mức cho cùng kết quả (quỹ gần đủ cho gói đắt nhất), không phải quỹ dư */
  same: boolean
  /** Quỹ dư mà khách đang ở Tùy chỉnh: vẫn chia theo tỷ lệ đã đặt (phần vượt gói đắt nhất tính theo gói đắt nhất) */
  keptCustom: boolean
  /** Tùy chỉnh, quỹ lớn hơn tổng giá gói đắt nhất: phần thừa tối thiểu (null: không phải trường hợp này) */
  spare: number | null
  /** Quỹ dư, còn dịch vụ chưa đúng gói đắt nhất: đặt mọi dịch vụ đúng vạch, phần còn lại vào Dự phòng */
  fill: (() => void) | null
  /** Có dịch vụ vượt gói đắt nhất: đưa về vạch, phần vượt vào Dự phòng */
  clamp: (() => void) | null
}) {
  if (!(sb > 0)) return null
  // Khi ba mức có sẵn bị khóa: một dòng hướng dẫn dùng Tùy chỉnh (hộp tím nhạt); Tùy chỉnh: một dòng chung về phần thừa
  return (
    <div className="flex flex-col gap-2.5">
      {presetLocked && (
        <p role="status" className="budget-note flex items-start gap-2 text-[13px]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {keptCustom
              ? 'Quỹ đủ cho gói đắt nhất của mọi dịch vụ. Đang chia theo tỷ lệ Tùy chỉnh của bạn, dịch vụ nào được chia nhiều hơn gói đắt nhất thì tính theo gói đắt nhất.'
              : 'Quỹ đủ cho gói đắt nhất của mọi dịch vụ nên không cần chia. Muốn tiết kiệm, chọn gói rẻ hơn ở bảng bên dưới hoặc giảm tổng ngân sách.'}
          </span>
        </p>
      )}
      {same && (
        <p role="status" className="budget-note flex items-start gap-2 text-[13px]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Quỹ gần đủ cho gói đắt nhất của mọi dịch vụ nên ba mức chia cho cùng kết quả. Muốn tự chia, ví dụ để dành một phần vào Dự phòng, bấm
            Tùy chỉnh.
          </span>
        </p>
      )}
      {spare !== null && (
        <div className="budget-note flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
          <p role="status" className="flex min-w-0 flex-1 items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Quỹ đủ cho gói đắt nhất của mọi dịch vụ, chia thế nào cũng dư ít nhất {money(spare)} ở Dự phòng. Muốn tiết kiệm, giảm tổng ngân
              sách hoặc chọn gói rẻ hơn.
            </span>
          </p>
          {fill && (
            <Button variant="outline" size="sm" onClick={fill}>
              Đặt mọi dịch vụ đúng gói đắt nhất
            </Button>
          )}
        </div>
      )}
      {clamp && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-2">
          <span className="flex items-start gap-1.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Có dịch vụ đang được chia nhiều hơn gói đắt nhất.
          </span>
          <Button variant="outline" size="sm" onClick={clamp}>
            Chuyển phần vượt vào Dự phòng
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Quỹ dư: mỗi dịch vụ một dòng, không có thanh kéo. Phương án có sẵn: mức chi = giá gói đắt nhất. Tùy chỉnh: mức khách đặt,
 * phần vượt cắt về giá gói đắt nhất.
 */
function SpendList({ view, sb }: { view: SplitView; sb: number }) {
  const spend = view.rows.map((r) => Math.min(r.amount, r.category.maxPackagePrice ?? r.amount))
  const top = Math.max(1, ...spend)
  // Một tông ô liu cùng thanh quỹ (budget-theme.css .budget-spend), thanh dài theo mức chi so với dịch vụ chi nhiều nhất.
  // Phương án có sẵn đã cắt về vạch nên luôn là "Gói đắt nhất". Tùy chỉnh: lệch dưới một bước tỷ lệ (0,01% quỹ) hoặc một đơn vị làm tròn
  // so với giá gói đắt nhất vẫn coi là chạm vạch.
  const tolerance = Math.max(DISPLAY_ROUND_UNIT / 2, sb / TOTAL)
  const atMax = (r: SplitView['rows'][number], x: number) => r.category.maxPackagePrice !== null && (!view.custom || x >= r.category.maxPackagePrice - tolerance)
  return (
    <ul className="budget-spend flex flex-col divide-y divide-line text-sm">
      {view.rows.map((r, i) => (
        <li key={r.item.id} className="grid grid-cols-[minmax(96px,150px)_1fr_auto] items-center gap-x-5 gap-y-2 py-3 first:pt-1 last:pb-1 max-sm:grid-cols-[1fr_auto]">
          <span className="font-medium text-ink">{r.category.name}</span>
          <span className="budget-bar max-sm:order-last max-sm:col-span-2" aria-hidden>
            <i style={{ width: `${(spend[i] / top) * 100}%` }} />
          </span>
          <span className="flex flex-col items-end leading-tight tabular-nums">
            <span className="font-semibold text-ink">{money(spend[i])}</span>
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{atMax(r, spend[i]) ? 'Gói đắt nhất' : 'Bạn tự chia'}</span>
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
 * Một hạng mục trong nhóm chia: thanh kéo (đơn vị 0,01%) có vạch giá gói cao nhất, ô "% quỹ", ô số tiền, nút khóa;
 * dưới thanh là ghi chú khi tiền vượt giá gói cao nhất (gợi ý chuyển phần thừa nằm ở SpendSummary).
 */
function SplitRow({
  r,
  sb,
  editable,
  single,
  onlyUnlocked,
  onDrag,
  onCommit,
  onRatio,
  onLock,
}: {
  r: SplitRowView
  sb: number
  editable: boolean
  single: boolean
  onlyUnlocked: boolean
  onDrag: (ratio: number) => void
  onCommit: () => void
  onRatio: (ratio: number) => void
  onLock: (value: boolean) => void
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
      <div className={ROW_GRID}>
        <span className={cn('inline-flex items-center gap-1.5 text-[15px] font-medium text-ink max-[760px]:col-span-3', item.locked && 'text-muted-foreground')}>
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
            className="w-full min-w-0 border-0 bg-transparent text-right text-sm text-ink-2 tabular-nums outline-none disabled:text-muted-foreground"
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
          className="px-2.5 py-1.5 text-right text-[15px] font-semibold text-ink tabular-nums disabled:opacity-60"
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
          </div>
        ) : (
          <span className="max-[760px]:hidden" />
        )}
      </div>
      {/* Vượt vạch không phải lỗi: phần vượt chỉ thành "Còn dư", nên chữ xám thay cho cảnh báo đỏ */}
      {r.warn && (
        <p className="pl-[152px] text-[12px] text-muted-foreground max-[760px]:pl-0">
          Gói đắt nhất {money(category.maxPackagePrice ?? 0)}, phần vượt {money(r.unused)} tính vào "Còn dư".
        </p>
      )}
    </div>
  )
}

/**
 * Dòng Dự phòng (Tùy chỉnh, từ 2 hạng mục): phần quỹ chưa giao cho dịch vụ nào, cùng bố cục với SplitRow.
 * Tăng thì bớt các dịch vụ mở khóa theo tương quan; giảm thì rót vào dịch vụ còn dưới gói đắt nhất.
 */
function ReserveRow({
  ratio,
  amount,
  sb,
  onDrag,
  onCommit,
  onRatio,
}: {
  ratio: number
  /** Tiền của Dự phòng (số chính xác) */
  amount: number
  sb: number
  onDrag: (ratio: number) => void
  onCommit: () => void
  onRatio: (ratio: number) => void
}) {
  const [pct, setPct] = useState<string | null>(null)
  const [money_, setMoney] = useState<number | null>(null)
  const commitPct = () => {
    const text = pct
    setPct(null)
    if (text === null) return
    const p = parsePercent(text)
    if (p.kind === 'empty') return
    if (p.kind === 'invalid') return toast(MSG.invalid)
    if (p.negative) toast(MSG.negative)
    if (p.ratio !== ratio || p.negative) onRatio(p.ratio)
  }
  const commitMoney = () => {
    const a = money_
    setMoney(null)
    if (a === null) return
    const wanted = ratioFromAmount(a, sb)
    if (wanted !== null) onRatio(wanted)
  }
  return (
    // Khối riêng (nền kem, viền nét đứt, biểu tượng heo đất) để khác dòng dịch vụ; lùi lề âm bằng đệm nên các ô vẫn thẳng cột
    <div className="-mx-3 flex flex-col gap-1.5 rounded-xl border border-dashed border-line-strong bg-[color-mix(in_srgb,var(--gold-100)_45%,transparent)] px-[11px] py-2.5">
      <div className={ROW_GRID}>
        <span className="inline-flex items-center gap-1.5 font-medium text-ink-2 max-[760px]:col-span-3">
          <PiggyBank className="size-4 shrink-0 text-gold-700" aria-hidden />
          Dự phòng
        </span>
        <input
          type="range"
          min={0}
          max={TOTAL}
          step={1}
          value={ratio}
          onChange={(e) => onDrag(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          aria-label="Tỷ lệ Dự phòng (% quỹ)"
          className="w-full accent-[#b8a06a] max-[760px]:col-span-3"
        />
        <label className="flex items-center gap-1 rounded-sm border border-input bg-surface px-2 py-1.5 focus-within:border-ring">
          <input
            inputMode="decimal"
            aria-label="Tỷ lệ % quỹ Dự phòng"
            value={pct ?? ratioText(ratio)}
            onFocus={() => setPct(ratioText(ratio))}
            onChange={(e) => setPct(e.target.value)}
            onBlur={commitPct}
            onKeyDown={blurOnEnter}
            className="w-full min-w-0 border-0 bg-transparent text-right text-sm text-ink-2 tabular-nums outline-none"
          />
          <span className="text-[12px] whitespace-nowrap text-muted-foreground">% quỹ</span>
        </label>
        <MoneyInput
          aria-label="Số tiền Dự phòng"
          placeholder="0"
          value={money_ ?? displayMoney(amount)}
          disabled={sb <= 0}
          onChange={setMoney}
          onBlur={commitMoney}
          onKeyDown={blurOnEnter}
          className="px-2.5 py-1.5 text-right text-[15px] font-semibold text-ink tabular-nums disabled:opacity-60"
        />
        <span className="max-[760px]:hidden" />
      </div>
      <p className="pl-[152px] text-[12px] text-muted-foreground max-[760px]:pl-0">
        Phần quỹ chưa giao cho dịch vụ nào. Giảm một dịch vụ thì tiền vào đây, tăng thì lấy từ đây trước.
      </p>
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
