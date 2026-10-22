import { Check } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import type { ServiceAlbum, ServiceDetail } from '@/types/catalog'
import { DetailCard } from './DetailCard'

/** Tab "Thông tin chung": giới thiệu, gói dịch vụ, bộ sưu tập (2.2). */
export function ServiceInfoPanel({ service, onOpenGallery }: { service: ServiceDetail; onOpenGallery: (album?: ServiceAlbum) => void }) {
  const highlights = service.capacity ? [...service.highlights, `Sức chứa tối đa ${service.capacity} khách`] : service.highlights

  return (
    <>
      <DetailCard title="Giới thiệu dịch vụ">
        <p className="leading-[1.7]">{service.description}</p>
        <ul className="mt-4 grid list-none gap-1.5 p-0">
          {highlights.map((h) => (
            <li key={h} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-sage" strokeWidth={2.2} aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      </DetailCard>

      <DetailCard title="Gói dịch vụ">
        <div className="grid gap-2.5">
          {service.packages.map((p) => (
            <div key={p.id} className="flex justify-between gap-3.5 rounded-md border border-line px-3.5 py-3">
              <div>
                <b className="font-semibold">{p.name}</b>
                <div className="text-[13px] text-muted-foreground">{p.description}</div>
              </div>
              <b className="shrink-0 font-semibold">{formatMoney(p.price)}</b>
            </div>
          ))}
        </div>
      </DetailCard>

      <div className="mt-[26px] mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-2xl">Bộ sưu tập</h2>
        <button type="button" onClick={() => onOpenGallery()} className="text-sm font-medium text-primary underline underline-offset-[3px]">
          Xem tất cả ảnh
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {service.albums.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpenGallery(a)}
            className="overflow-hidden rounded-[20px] border border-line bg-surface p-0 text-left"
          >
            <div className="grid grid-cols-[2fr_1fr] grid-rows-[70px_70px] gap-[3px]">
              {a.previewImageUrls.map((src, i) => (
                <div key={src} className="overflow-hidden bg-line first:row-span-2">
                  <img src={src} alt={`${a.title}, ảnh ${i + 1}`} loading="lazy" className="block size-full object-cover" />
                </div>
              ))}
            </div>
            <div className="px-4 pt-3.5 pb-4">
              <b className="block font-serif text-[15px] font-semibold">{a.title}</b>
              <small className="text-xs text-muted-foreground">{a.imageCount} ảnh trong album</small>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
