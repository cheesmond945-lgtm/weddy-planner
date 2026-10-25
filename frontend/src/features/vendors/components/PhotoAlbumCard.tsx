import { FileText, ImagePlus, LayoutGrid, LoaderCircle, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { GalleryDialog } from '@/features/catalog/components/GalleryDialog'
import { cn } from '@/lib/utils'
import type { VendorFile } from '@/types/vendor'
import { IMAGE_TYPES, MAX_FILE_SIZE, MAX_PHOTOS } from '../constants'
import type { VendorUploadPurpose } from '@/types/vendor'
import { useUploadVendorFile } from '../hooks'
import { ConfirmDialog } from './ConfirmDialog'

interface PhotoAlbumCardProps {
  label: string
  required?: boolean
  photos: VendorFile[]
  /** Tên trong tiêu đề bộ ảnh, VD "cơ sở" -> "Ảnh của cơ sở" */
  galleryTitle: string
  /** Mặc định VENDOR_DOCUMENT (ảnh cơ sở, giấy tờ); ảnh gói dùng PACKAGE_PHOTO (công khai, tối đa 5MB) */
  purpose?: Extract<VendorUploadPurpose, 'VENDOR_DOCUMENT' | 'PACKAGE_PHOTO'>
  /** Giới hạn dung lượng mỗi ảnh (MB), mặc định 10 */
  maxMB?: number
  /** Số ảnh tối đa trong khung */
  maxPhotos?: number
  /** Xếp ảnh dạng lưới như trang dịch vụ phía khách: một ảnh lớn bên trái, các ảnh nhỏ bên phải */
  mosaic?: boolean
  locked: boolean
  error?: string
  onChange: (photos: VendorFile[]) => void
}

/**
 * Ảnh cơ sở và giấy tờ dạng một khung album (giống thẻ ảnh gói dịch vụ): ảnh bìa, số ảnh, thêm nhiều ảnh vào cùng khung,
 * bấm ảnh để xem như bộ ảnh gói của khách. Thùng rác xóa cả album; ảnh lẻ xóa ở dải ảnh nhỏ bên dưới.
 */
export function PhotoAlbumCard({ label, required, photos, galleryTitle, purpose = 'VENDOR_DOCUMENT', maxMB = MAX_FILE_SIZE / 1048576, maxPhotos = MAX_PHOTOS, mosaic, locked, error, onChange }: PhotoAlbumCardProps) {
  const upload = useUploadVendorFile(purpose)
  const [fileError, setFileError] = useState('')
  const [viewing, setViewing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const room = maxPhotos - photos.length

  async function handleFiles(list: FileList | null) {
    const problems: string[] = []
    const accepted: File[] = []
    for (const f of Array.from(list ?? [])) {
      if (!IMAGE_TYPES.includes(f.type)) problems.push(`${f.name}: chỉ nhận JPG, PNG, WEBP`)
      else if (f.size > maxMB * 1048576) problems.push(`${f.name}: vượt ${maxMB}MB`)
      else accepted.push(f)
    }
    if (accepted.length > room) problems.push(`Chỉ thêm được tối đa ${maxPhotos} ảnh, đã bỏ ${accepted.length - room} ảnh cuối.`)
    const added: VendorFile[] = []
    for (const f of accepted.slice(0, Math.max(room, 0))) {
      try {
        added.push(await upload.mutateAsync(f))
      } catch (e) {
        problems.push(`${f.name}: ${(e as Error).message}`)
      }
    }
    setFileError(problems.join(' · '))
    if (added.length) onChange([...photos, ...added])
  }

  const message = fileError || (!photos.length ? error : undefined)
  const cover = photos[0]

  return (
    <div className="grid min-w-0 content-start gap-2">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <strong className="text-[14px] font-semibold">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </strong>
        {!locked && (
          <button
            type="button"
            title="Xóa tất cả ảnh"
            aria-label={`Xóa tất cả ảnh ${label}`}
            disabled={!photos.length}
            onClick={() => setConfirmClear(true)}
            className="grid size-9 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-warn-soft hover:text-warn disabled:pointer-events-none disabled:opacity-35"
          >
            <Trash2 className="size-[18px]" />
          </button>
        )}
      </div>
      <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-portal', message && 'border-destructive')}>
        <div className="relative aspect-[16/9] bg-surface-2">
          {cover && !cover.mimeType.startsWith('image/') ? (
            <a href={cover.url || undefined} target="_blank" rel="noreferrer" aria-label={`Mở ${cover.fileName}`} className="grid size-full place-items-center content-center gap-1.5 p-3 text-center">
              <FileText className="size-9 text-gold" />
              <span className="line-clamp-2 text-[12.5px] [overflow-wrap:anywhere]">{cover.fileName}</span>
            </a>
          ) : cover && mosaic ? (
            <div
              className={cn(
                'grid size-full gap-1',
                photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-[2fr_1fr_1fr] grid-rows-2 max-[700px]:grid-cols-2 max-[700px]:grid-rows-[1.6fr_1fr_1fr]',
              )}
            >
              {photos.slice(0, 5).map((p, i) => (
                <button
                  key={p.publicId}
                  type="button"
                  aria-label={`Xem ảnh ${i + 1}`}
                  onClick={() => setViewing(true)}
                  className={cn('block cursor-zoom-in overflow-hidden bg-line', photos.length >= 3 && 'first:row-span-2 max-[700px]:first:col-span-2 max-[700px]:first:row-span-1')}
                >
                  <img src={p.url} alt={p.fileName} loading={i ? 'lazy' : undefined} className="block size-full object-cover" />
                </button>
              ))}
            </div>
          ) : cover ? (
            <button type="button" onClick={() => setViewing(true)} aria-label={`Xem ${label}`} className="block size-full cursor-zoom-in">
              <img src={cover.url} alt={cover.fileName} className="size-full object-cover" />
            </button>
          ) : (
            <div className="grid size-full place-items-center content-center gap-1.5 text-muted-foreground">
              <ImagePlus className="size-8" strokeWidth={1.5} />
              <span className="text-[12.5px]">Chưa có ảnh</span>
            </div>
          )}
          {photos.length > 0 &&
            (mosaic ? (
              <button
                type="button"
                onClick={() => setViewing(true)}
                className="absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-pill bg-surface px-4 py-2 text-[13px] font-semibold text-ink shadow-fab"
              >
                <LayoutGrid className="size-4" aria-hidden />
                Xem tất cả {photos.length} ảnh
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3 bottom-3 rounded-pill bg-ink/65 px-3 py-1 text-[13px] font-semibold text-white tabular-nums">{photos.length} ảnh</span>
            ))}
        </div>

        {!locked && photos.length > 1 && (
          <ul className="flex gap-1.5 overflow-x-auto px-4 py-3">
            {photos.map((p, i) => (
              <li key={p.publicId} className="group relative size-11 flex-none overflow-hidden rounded-sm border border-line">
                <button type="button" onClick={() => setViewing(true)} aria-label={`Xem ảnh ${i + 1}`} className="block size-full">
                  <img src={p.url} alt={p.fileName} className="size-full object-cover" />
                </button>
                <button
                  type="button"
                  aria-label={`Xóa ảnh ${i + 1}`}
                  onClick={() => onChange(photos.filter((x) => x.publicId !== p.publicId))}
                  className="absolute inset-0 grid place-items-center bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/70 px-4 py-3 text-[13px]">
          {locked ? (
            <span />
          ) : (
            <label
              className={cn(
                'relative inline-flex cursor-pointer items-center gap-2 font-semibold tracking-wide text-sage uppercase focus-within:outline-2 focus-within:outline-ring',
                (upload.isPending || room <= 0) && 'pointer-events-none opacity-50',
              )}
            >
              {upload.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <span className="text-lg leading-none">+</span>}
              {upload.isPending ? 'Đang tải…' : 'Thêm ảnh'}
              <input
                type="file"
                multiple
                accept={IMAGE_TYPES.join(',')}
                aria-label={`Thêm ${label}`}
                className="absolute size-px opacity-0"
                onChange={(e) => {
                  void handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          )}
          <span className="text-muted-foreground">Tối đa {maxMB}MB/ảnh</span>
        </div>
      </div>

      {message && (
        <p role="alert" data-field-error className="text-[12.5px] text-destructive">
          {message}
        </p>
      )}

      <GalleryDialog title={galleryTitle} images={photos.filter((p) => p.mimeType.startsWith('image/')).map((p) => p.url)} open={viewing} onOpenChange={setViewing} />
      <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear} danger title="Xóa tất cả ảnh?" confirmLabel="Xóa tất cả" onConfirm={() => onChange([])}>
        <p>
          {photos.length} ảnh sẽ bị gỡ khỏi mục này.{required ? ' Đây là mục bắt buộc, bạn cần tải ảnh mới trước khi gửi.' : ''}
        </p>
      </ConfirmDialog>
    </div>
  )
}
