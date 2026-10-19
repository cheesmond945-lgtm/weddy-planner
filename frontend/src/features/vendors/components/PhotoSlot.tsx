import { ImagePlus, LoaderCircle, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { VendorPhoto, VendorPhotoType } from '@/types/vendor'
import { IMAGE_TYPES, MAX_FILE_SIZE, type FileSlot } from '../constants'
import { useUploadVendorFile } from '../hooks'
import { PhotoViewerDialog } from './PhotoViewerDialog'

interface PhotoSlotProps {
  slot: FileSlot<VendorPhotoType>
  required: boolean
  photos: VendorPhoto[]
  locked: boolean
  error?: string
  onAdd: (photos: VendorPhoto[]) => void
  onRemove: (publicId: string) => void
}

/** Một loại ảnh cơ sở (mặt tiền, sảnh): tải nhiều ảnh, xem lớn, xóa (PhotoSlot trong prototype NCC). */
export function PhotoSlot({ slot, required, photos, locked, error, onAdd, onRemove }: PhotoSlotProps) {
  const upload = useUploadVendorFile('VENDOR_PHOTO')
  const [fileError, setFileError] = useState('')
  const [viewing, setViewing] = useState<number | null>(null)

  async function handleFiles(list: FileList | null) {
    const problems: string[] = []
    const accepted: File[] = []
    for (const f of Array.from(list ?? [])) {
      if (!IMAGE_TYPES.includes(f.type)) problems.push(`${f.name}: chỉ nhận JPG, PNG, WEBP`)
      else if (f.size > MAX_FILE_SIZE) problems.push(`${f.name}: vượt 10MB`)
      else accepted.push(f)
    }
    const added: VendorPhoto[] = []
    for (const f of accepted) {
      try {
        added.push({ type: slot.type, ...(await upload.mutateAsync(f)) })
      } catch (e) {
        problems.push(`${f.name}: ${(e as Error).message}`)
      }
    }
    setFileError(problems.join(' · '))
    if (added.length) onAdd(added)
  }

  const message = fileError || error

  return (
    <div className="grid content-start gap-2.5 rounded-md border border-line p-3.5">
      <div className="flex items-center justify-between gap-2.5 text-[13.5px]">
        <strong className="font-semibold">
          {slot.label}
          {required && ' *'}
        </strong>
        {!locked && (
          <label
            className={cn(
              'relative inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[13px] whitespace-nowrap hover:border-gold focus-within:outline-2 focus-within:outline-ring',
              upload.isPending && 'pointer-events-none opacity-60',
            )}
          >
            {upload.isPending ? <LoaderCircle className="size-[15px] animate-spin" /> : <ImagePlus className="size-[15px]" />}
            {upload.isPending ? 'Đang tải…' : 'Tải ảnh'}
            <input
              type="file"
              multiple
              accept={IMAGE_TYPES.join(',')}
              aria-label={`Tải ${slot.label}`}
              className="absolute size-px opacity-0"
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>

      {photos.length ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p.publicId} className="relative h-[72px] w-24 overflow-hidden rounded-sm border border-line">
              <button type="button" onClick={() => setViewing(i)} aria-label={`Xem ${p.fileName}`} className="block size-full cursor-zoom-in">
                <img src={p.url} alt={p.fileName} className="size-full object-cover" />
              </button>
              {!locked && (
                <button
                  type="button"
                  aria-label={`Xóa ${p.fileName}`}
                  title="Xóa ảnh"
                  onClick={() => onRemove(p.publicId)}
                  className="absolute top-[3px] right-[3px] grid size-7 place-items-center rounded-sm bg-surface/90 text-muted-foreground hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">Chưa có ảnh.</p>
      )}

      {message && (
        <p role="alert" data-field-error className="text-[12.5px] text-destructive">
          {message}
        </p>
      )}

      <PhotoViewerDialog title={slot.label} photos={photos} index={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
