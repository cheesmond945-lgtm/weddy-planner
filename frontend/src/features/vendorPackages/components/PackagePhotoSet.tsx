import { ArrowLeft, ArrowRight, Images, LoaderCircle, Plus, Star, Trash2, X } from 'lucide-react'
import { useState, type DragEvent, type ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PhotoViewerDialog } from '@/features/vendors/components/PhotoViewerDialog'
import { IMAGE_TYPES, MAX_FILE_SIZE } from '@/features/vendors/constants'
import { useUploadVendorFile } from '@/features/vendors/hooks'
import { cn } from '@/lib/utils'
import type { VendorFile } from '@/types/vendor'
import { coverOf } from '../constants'

export interface PhotoSetValue {
  photos: VendorFile[]
  coverPublicId: string | null
}

interface PackagePhotoSetProps extends PhotoSetValue {
  /** Nhận hàm cập nhật để không ghi đè khi nhiều ảnh tải lên cùng lúc */
  onChange?: (update: (prev: PhotoSetValue) => PhotoSetValue) => void
  readOnly?: boolean
  error?: string
}

interface UploadRow {
  key: string
  name: string
  error?: string
}

const COLLAGE: Record<number, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-[1.55fr_1fr] grid-rows-2 [&>:first-child]:row-span-2',
  4: 'grid-cols-[1.75fr_1fr] grid-rows-3 [&>:first-child]:row-span-3',
}

/** Bộ ảnh của gói: ảnh ghép, thêm ảnh (chọn hoặc kéo thả), quản lý ảnh bìa và thứ tự (PhotoSet trong prototype NCC). */
export function PackagePhotoSet({ photos, coverPublicId, onChange, readOnly, error }: PackagePhotoSetProps) {
  const upload = useUploadVendorFile('PACKAGE_PHOTO')
  const [uploads, setUploads] = useState<UploadRow[]>([])
  const [drag, setDrag] = useState(false)
  const [manage, setManage] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const editable = !readOnly && !!onChange

  const cover = coverOf({ photos, coverPublicId })
  const collage = cover ? [cover, ...photos.filter((p) => p !== cover)].slice(0, 4) : []

  function addFiles(list: FileList | null) {
    if (!onChange) return
    for (const f of Array.from(list ?? [])) {
      const key = `${Date.now()}-${Math.random()}`
      const problem = !IMAGE_TYPES.includes(f.type) ? 'Chỉ nhận JPG, PNG, WEBP' : f.size > MAX_FILE_SIZE ? `${(f.size / 1048576).toFixed(1)}MB, vượt 10MB` : ''
      setUploads((u) => [...u, { key, name: f.name, error: problem || undefined }])
      if (problem) continue
      upload
        .mutateAsync(f)
        .then((file) => {
          onChange((prev) => ({ photos: [...prev.photos, file], coverPublicId: prev.coverPublicId ?? prev.photos[0]?.publicId ?? file.publicId }))
          setUploads((u) => u.filter((x) => x.key !== key))
        })
        .catch((e: Error) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: e.message } : x))))
    }
  }

  const move = (i: number, step: number) =>
    onChange?.((prev) => {
      const next = [...prev.photos]
      const j = i + step
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...prev, photos: next }
    })

  const remove = (publicId: string) =>
    onChange?.((prev) => {
      const next = prev.photos.filter((p) => p.publicId !== publicId)
      return { photos: next, coverPublicId: prev.coverPublicId === publicId ? (next[0]?.publicId ?? null) : prev.coverPublicId }
    })

  const uploadButton = (className: string, children: ReactNode, label = 'Thêm hình ảnh dịch vụ') => (
    <label className={cn('relative cursor-pointer focus-within:outline-2 focus-within:outline-ring', className)}>
      {children}
      <input
        type="file"
        multiple
        accept={IMAGE_TYPES.join(',')}
        aria-label={label}
        className="absolute size-px opacity-0"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )

  const uploadList = editable && uploads.length > 0 && (
    <div className="mt-3 grid max-w-[410px] gap-1.5">
      {uploads.map((u) => (
        <div
          key={u.key}
          className={cn('flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[12.5px]', u.error ? 'bg-warn-soft text-warn' : 'bg-surface-2')}
        >
          <span className="min-w-0 flex-1 truncate">{u.name}</span>
          {u.error ? (
            <>
              <em className="not-italic">{u.error}</em>
              <button type="button" aria-label="Bỏ thông báo lỗi" onClick={() => setUploads((x) => x.filter((r) => r.key !== u.key))} className="grid size-6 place-items-center rounded-sm hover:bg-ink/10">
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <LoaderCircle className="size-4 animate-spin text-gold" aria-label="Đang tải lên" />
          )}
        </div>
      ))}
    </div>
  )

  const dragProps = editable
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault()
          setDrag(true)
        },
        onDragLeave: () => setDrag(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          setDrag(false)
          addFiles(e.dataTransfer.files)
        },
      }
    : {}

  return (
    <div className="max-w-[410px]" {...dragProps}>
      {photos.length ? (
        <div className={cn('overflow-hidden rounded-[18px] border border-line bg-surface shadow-portal transition-shadow hover:shadow-portal-lift', drag && 'border-gold/40 shadow-portal-lift')}>
          <button
            type="button"
            onClick={() => setManage(true)}
            aria-label={`Xem ${photos.length} hình ảnh dịch vụ`}
            className={cn('group relative block aspect-[410/290] w-full cursor-zoom-in overflow-hidden bg-surface-2', readOnly ? 'rounded-[17px]' : 'rounded-t-[17px]')}
          >
            <span className={cn('absolute inset-0 grid gap-1', COLLAGE[collage.length])}>
              {collage.map((p, i) => (
                <span key={p.publicId} className="relative min-h-0 min-w-0 overflow-hidden bg-surface-2">
                  <img src={p.url} alt={i ? '' : 'Ảnh bìa dịch vụ'} className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                </span>
              ))}
            </span>
            <span className="absolute top-3 right-3 z-[2] rounded-pill bg-black/55 px-[11px] py-1 text-[12.5px] font-semibold text-white backdrop-blur-sm">{photos.length} ảnh</span>
            <span className="absolute inset-x-0 bottom-0 z-[2] flex translate-y-1.5 items-center justify-center gap-1.5 bg-linear-to-b from-transparent to-black/65 p-2.5 text-[13px] font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
              <Images className="size-[15px]" />
              Xem tất cả
            </span>
          </button>
          {editable && (
            <div className="flex min-h-[60px] items-center justify-between gap-2.5 border-t border-line bg-gold-soft/35 px-4 py-2.5">
              {uploadButton(
                'inline-flex h-9 items-center gap-1.5 rounded-sm border border-gold/45 bg-surface px-3 text-[13px] text-gold-ink hover:bg-gold-soft',
                <>
                  <Plus className="size-[15px]" />
                  Thêm ảnh
                </>,
                'Thêm ảnh vào bộ ảnh',
              )}
              <span className="text-xs text-muted-foreground">Tối đa 10MB/ảnh</span>
            </div>
          )}
        </div>
      ) : readOnly ? (
        <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-dashed border-line-strong p-[18px] text-[13.5px] text-muted-foreground">
          <Images className="size-[26px] flex-none text-gold" />
          Gói chưa có hình ảnh.
        </div>
      ) : (
        uploadButton(
          cn(
            'flex aspect-[410/350] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gold/55 bg-gold-soft/60 p-[18px] text-center transition hover:-translate-y-0.5 hover:border-gold hover:bg-gold-soft [&:hover_.dz-plus]:rotate-90',
            drag && 'border-gold bg-gold-soft',
          ),
          <>
            <span className="dz-plus mb-1 grid size-[54px] place-items-center rounded-full bg-(image:--gold-grad) text-gold-on transition-transform duration-500">
              <Plus className="size-7" strokeWidth={2.2} />
            </span>
            <strong className="text-[15px]">Thêm hình ảnh</strong>
            <span className="text-[12.5px] text-muted-foreground">Chọn hoặc kéo thả nhiều ảnh · JPG, PNG, WEBP · Tối đa 10MB/ảnh</span>
          </>,
        )
      )}
      {uploadList}
      {error && (
        <p role="alert" data-field-error className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      )}

      <Dialog open={manage} onOpenChange={setManage}>
        <DialogContent className="max-w-[980px]">
          <DialogHeader>
            <DialogTitle>Hình ảnh dịch vụ</DialogTitle>
            <DialogDescription>
              {photos.length} hình ảnh{readOnly ? ' · chỉ xem' : ''}
            </DialogDescription>
          </DialogHeader>
          {editable && (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {uploadButton(
                'inline-flex h-[34px] items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[13px] hover:border-gold',
                <>
                  <Plus className="size-4" />
                  Thêm ảnh
                </>,
                'Thêm ảnh trong hộp quản lý ảnh',
              )}
              <span className="text-xs text-muted-foreground">JPG, PNG, WEBP · Tối đa 10MB/ảnh · ảnh được lưu khi bạn Lưu nháp hoặc Gửi duyệt</span>
            </div>
          )}
          {uploadList}
          {photos.length ? (
            <div className="mt-1 grid grid-cols-4 gap-3.5 max-[1000px]:grid-cols-3 max-sm:grid-cols-2">
              {photos.map((p, i) => {
                const isCover = p === cover
                return (
                  <figure key={p.publicId} className={cn('relative m-0 overflow-hidden rounded-lg border border-line bg-surface', isCover && 'outline-2 -outline-offset-2 outline-gold')}>
                    <button
                      type="button"
                      onClick={() => setViewing(i)}
                      aria-label={`Xem lớn ảnh ${i + 1}`}
                      className="block h-40 w-full cursor-zoom-in bg-surface-2 p-1.5 max-sm:h-[130px]"
                    >
                      <img src={p.url} alt={`Ảnh dịch vụ ${i + 1}`} loading="lazy" className="size-full object-contain" />
                    </button>
                    {isCover && (
                      <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-pill bg-(image:--gold-grad) px-2 py-0.5 text-[11px] text-gold-on">
                        <Star className="size-[11px]" />
                        Ảnh bìa
                      </span>
                    )}
                    {editable && (
                      <figcaption className="flex justify-between border-t border-line p-1 [&_button]:grid [&_button]:size-7 [&_button]:place-items-center [&_button]:rounded-sm [&_button]:text-muted-foreground [&_button:hover:not(:disabled)]:bg-surface-2 [&_button:hover:not(:disabled)]:text-ink [&_button:disabled]:opacity-40 [&_svg]:size-3.5">
                        <button type="button" aria-label="Chọn làm ảnh bìa" title="Chọn làm ảnh bìa" disabled={isCover} onClick={() => onChange?.((prev) => ({ ...prev, coverPublicId: p.publicId }))}>
                          <Star />
                        </button>
                        <button type="button" aria-label="Đưa ảnh lên trước" title="Lên trước" disabled={!i} onClick={() => move(i, -1)}>
                          <ArrowLeft />
                        </button>
                        <button type="button" aria-label="Đưa ảnh ra sau" title="Ra sau" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                          <ArrowRight />
                        </button>
                        <button type="button" aria-label="Xóa ảnh" title="Xóa ảnh" onClick={() => remove(p.publicId)} className="!text-warn">
                          <Trash2 />
                        </button>
                      </figcaption>
                    )}
                  </figure>
                )
              })}
            </div>
          ) : (
            <EmptyState title="Chưa có hình ảnh" description={readOnly ? undefined : 'Bấm “Thêm ảnh” để tải ảnh.'} />
          )}
        </DialogContent>
      </Dialog>

      <PhotoViewerDialog title="Hình ảnh dịch vụ" photos={photos} index={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
