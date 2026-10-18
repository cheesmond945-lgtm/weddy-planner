import { useReveal } from '@/lib/useReveal'
import { PRICE_RANGES, type ServiceFilters } from '../filters'

interface ServiceFilterSelectsProps {
  locations: string[]
  filters: ServiceFilters
  onChange: (patch: Partial<ServiceFilters>) => void
}

const selectClass =
  'w-auto min-w-[145px] cursor-pointer rounded-md border border-line bg-surface px-3 py-[9px] text-[11px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring'

/** Lọc theo khu vực và mức giá (service-filters trong prototype). */
export function ServiceFilterSelects({ locations, filters, onChange }: ServiceFilterSelectsProps) {
  const reveal = useReveal<HTMLDivElement>()
  return (
    <div ref={reveal.ref} className={`mb-3 flex flex-wrap items-center gap-2.5 ${reveal.className}`}>
      <select aria-label="Khu vực" value={filters.location} onChange={(e) => onChange({ location: e.target.value })} className={selectClass}>
        <option value="">♧ &nbsp; Tất cả khu vực</option>
        {locations.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select aria-label="Mức giá" value={filters.price} onChange={(e) => onChange({ price: e.target.value })} className={selectClass}>
        <option value="">♢ &nbsp; Mọi mức giá</option>
        {PRICE_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  )
}
