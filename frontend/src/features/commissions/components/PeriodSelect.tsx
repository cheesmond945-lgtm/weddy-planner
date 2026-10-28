import type { CommissionStatementSummary } from '@/types/commission'

/** Chọn kỳ (tháng) xem số liệu, như ô chọn "Tháng 09/2026" của prototype. */
export function PeriodSelect({ statements, value, onChange }: { statements: CommissionStatementSummary[]; value: string; onChange: (id: string) => void }) {
  return (
    <select
      aria-label="Kỳ đối soát"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-[120px] rounded-sm border border-line-strong bg-surface px-3 text-[13.5px] focus:border-gold focus:outline-none"
    >
      {statements.map((s) => (
        <option key={s.id} value={s.id}>
          {/* Năm đã chọn ở ô Năm bên cạnh nên chỉ hiện tháng */}
          Tháng {s.period.slice(5, 7)}
        </option>
      ))}
    </select>
  )
}
