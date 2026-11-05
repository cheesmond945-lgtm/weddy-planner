import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useId, useState, type ChangeEvent } from 'react'
import { weddingsApi } from '@/api/weddings'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { ImportRequest, ImportType } from '@/types/wedding'
import { IMPORT_FIELDS, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, PREVIEW_ROWS, autoMap, canBeMonthFirst, mapRows } from './columns'

const TITLE: Record<ImportType, string> = { tasks: 'Nhập công việc từ Excel', expenses: 'Nhập chi phí khác từ Excel' }
/** Dữ liệu cần làm mới sau khi nhập */
const REFRESH: Record<ImportType, string[]> = { tasks: ['timeline', 'overview'], expenses: ['budget', 'overview', 'wedding'] }

interface Sheet {
  fileName: string
  headers: string[]
  rows: unknown[][]
}

const pad = (n: number) => String(n).padStart(2, '0')
/** Ô ngày của Excel -> "YYYY-MM-DD" để backend không phải đoán thứ tự ngày tháng. */
const cellText = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : v === null || v === undefined ? '' : String(v))

/** Đọc sheet đầu tiên. SheetJS tải lười (chỉ khi người dùng chọn file). CSV đọc dạng chữ để không tự đổi ngày. */
async function readSheet(file: File): Promise<Sheet> {
  const XLSX = await import('xlsx')
  const isCsv = /\.csv$/i.test(file.name)
  const wb = isCsv ? XLSX.read(await file.text(), { type: 'string', raw: true }) : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('File không có trang tính nào.')
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '', blankrows: false })
  const lines = all.map((r) => r.map(cellText)).filter((r) => r.some((c) => c.trim()))
  if (lines.length < 2) throw new Error('File cần có dòng tiêu đề và ít nhất 1 dòng dữ liệu.')
  if (lines.length - 1 > IMPORT_MAX_ROWS) throw new Error(`Tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập (file có ${lines.length - 1} dòng).`)
  return { fileName: file.name, headers: lines[0].map((h) => h.trim()), rows: lines.slice(1) }
}

/**
 * Nhập Excel/CSV (P6): chọn file, ghép cột (tự động, sửa được), xem trước 50 dòng kèm lỗi do backend kiểm tra (dryRun),
 * rồi nhập các dòng hợp lệ. Chi phí khác chọn được "Thêm vào" hoặc "Thay toàn bộ".
 */
export function ImportDialog({ type, open, onOpenChange, version }: { type: ImportType; open: boolean; onOpenChange: (open: boolean) => void; /** Chi phí khác: phiên bản ngân sách đã đọc */ version?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{TITLE[type]}</DialogTitle>
          <DialogDescription>File .xlsx, .xls hoặc .csv, tối đa {IMPORT_MAX_ROWS} dòng và 2 MB. Dòng đầu tiên là tiêu đề cột.</DialogDescription>
        </DialogHeader>
        {open && <ImportBody type={type} version={version} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportBody({ type, version, onClose }: { type: ImportType; version?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const inputId = useId()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [mapping, setMapping] = useState<Record<string, number | null>>({})
  const [mode, setMode] = useState<'APPEND' | 'REPLACE'>('APPEND')
  const [dateOrder, setDateOrder] = useState<'DMY' | 'MDY'>('DMY')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const fields = IMPORT_FIELDS[type]

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(undefined)
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setError('Chỉ nhận file .xlsx, .xls hoặc .csv.')
    if (file.size > IMPORT_MAX_BYTES) return setError('File lớn hơn 2 MB.')
    try {
      const s = await readSheet(file)
      setSheet(s)
      setMapping(autoMap(s.headers, type))
      setDateOrder('DMY')
    } catch (err) {
      setSheet(null)
      setError(err instanceof Error && err.message ? err.message : 'Không đọc được file.')
    }
  }

  const missing = fields.filter((f) => f.required && (mapping[f.key] ?? null) === null)
  const rows = sheet ? mapRows(sheet.rows, mapping) : []
  const monthFirstOk = type === 'tasks' && canBeMonthFirst(rows.map((r) => r.dueDate))
  const request: ImportRequest = { rows, mode: type === 'tasks' ? 'APPEND' : mode, dateOrder: monthFirstOk ? dateOrder : 'DMY' }

  // Backend kiểm tra lại từng dòng (dryRun) mỗi khi đổi file, cách ghép cột hoặc lựa chọn
  const check = useQuery({
    queryKey: ['import-check', type, sheet?.fileName, JSON.stringify(mapping), request.mode, request.dateOrder],
    queryFn: () => weddingsApi.importRows(type, { ...request, dryRun: true }),
    enabled: !!sheet && !missing.length,
    gcTime: 0,
    retry: false,
  })
  const issues = new Map((check.data?.issues ?? []).map((i) => [i.row, i]))

  async function submit() {
    setSaving(true)
    try {
      const r = await weddingsApi.importRows(type, { ...request, ...(version && { version }) })
      await Promise.all(REFRESH[type].map((k) => qc.invalidateQueries({ queryKey: [k] })))
      toast(r.invalid ? `Đã nhập ${r.created} dòng, bỏ qua ${r.invalid} dòng lỗi` : `Đã nhập ${r.created} dòng`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhập được.')
    } finally {
      setSaving(false)
    }
  }

  const select = 'w-full rounded-sm border border-input bg-surface px-2.5 py-2 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild variant="outline">
          <label htmlFor={inputId} className="cursor-pointer">
            <FileSpreadsheet />
            {sheet ? 'Chọn file khác' : 'Chọn file'}
          </label>
        </Button>
        <input id={inputId} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={pick} />
        {sheet && (
          <span className="text-sm text-muted-foreground">
            {sheet.fileName}, {sheet.rows.length} dòng
          </span>
        )}
        <Button variant="link" size="sm" className="ml-auto" onClick={() => weddingsApi.downloadTemplate(type).catch((e: Error) => toast(e.message))}>
          <Download />
          Tải file mẫu
        </Button>
      </div>

      {sheet && (
        <>
          <fieldset className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            <legend className="mb-2 text-[13px] font-medium">Ghép cột</legend>
            {fields.map((f) => (
              <label key={f.key} className="text-[13px]">
                <span className="mb-1 block">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </span>
                <select
                  className={select}
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                >
                  <option value="">Không dùng</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Cột ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {type !== 'tasks' && (
              <div role="radiogroup" aria-label="Cách nhập" className="flex gap-4">
                {(['APPEND', 'REPLACE'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5">
                    <input type="radio" name="import-mode" checked={mode === m} onChange={() => setMode(m)} className="accent-gold" />
                    {m === 'APPEND' ? 'Thêm vào danh sách' : 'Thay toàn bộ danh sách'}
                  </label>
                ))}
              </div>
            )}
            {type === 'tasks' && (
              <label className="flex items-center gap-2">
                Cột hạn ghi theo
                <select className={cn(select, 'w-auto')} value={monthFirstOk ? dateOrder : 'DMY'} disabled={!monthFirstOk} onChange={(e) => setDateOrder(e.target.value as 'DMY' | 'MDY')}>
                  <option value="DMY">ngày/tháng/năm</option>
                  <option value="MDY">tháng/ngày/năm</option>
                </select>
              </label>
            )}
          </div>
          {mode === 'REPLACE' && type !== 'tasks' && <p className="text-[13px] text-warn">Toàn bộ danh sách hiện có sẽ bị xóa và thay bằng các dòng hợp lệ trong file.</p>}

          {missing.length ? (
            <p className="text-sm text-destructive">Chọn cột cho: {missing.map((f) => f.label).join(', ')}.</p>
          ) : (
            <p className="text-sm" aria-live="polite">
              {check.isFetching
                ? 'Đang kiểm tra…'
                : check.data && (
                    <>
                      <b className="text-sage">{check.data.valid} dòng hợp lệ</b>
                      {!!check.data.invalid && <b className="text-destructive">, {check.data.invalid} dòng lỗi (sẽ bỏ qua)</b>}
                    </>
                  )}
            </p>
          )}

          <div className="max-h-[320px] overflow-auto rounded-md border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-accent-soft">
                <tr>
                  <th className="px-2.5 py-2 font-semibold">#</th>
                  {fields.map((f) => (
                    <th key={f.key} className="px-2.5 py-2 font-semibold whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-2.5 py-2 font-semibold">Kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((r, i) => {
                  const issue = issues.get(i + 1)
                  const bad = !!issue?.errors.length
                  return (
                    <tr key={i} className={cn('border-t border-line', bad && 'bg-warn-soft')}>
                      <td className="px-2.5 py-1.5 text-muted-foreground">{i + 1}</td>
                      {fields.map((f) => (
                        <td key={f.key} className="max-w-[180px] truncate px-2.5 py-1.5">
                          {r[f.key]}
                        </td>
                      ))}
                      <td className={cn('px-2.5 py-1.5', bad ? 'text-destructive' : 'text-muted-foreground')}>{issue ? [...issue.errors, ...issue.warnings].join(' ') : check.data ? 'OK' : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW_ROWS && <p className="text-[13px] text-muted-foreground">Đang xem trước {PREVIEW_ROWS} trên {rows.length} dòng.</p>}
        </>
      )}

      <FormError message={error ?? (check.error as Error | null)?.message} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="button" disabled={!check.data?.valid || check.isFetching || saving} onClick={submit}>
          {check.data?.valid ? `Nhập ${check.data.valid} dòng` : 'Nhập'}
        </Button>
      </DialogFooter>
    </div>
  )
}
