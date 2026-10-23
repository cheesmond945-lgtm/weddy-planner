import { Eye, FileText, Image as ImageIcon, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { VendorDocument, VendorDocumentType } from '@/types/vendor'
import { DOCUMENT_TYPES, formatFileSize, MAX_FILE_SIZE, type FileSlot } from '../constants'
import { useUploadVendorFile } from '../hooks'
import { ConfirmDialog } from './ConfirmDialog'

interface DocumentRowProps {
  slot: FileSlot<VendorDocumentType>
  file: VendorDocument | undefined
  locked: boolean
  error?: string
  onChange: (file: VendorDocument | null) => void
}

const iconBtn =
  'grid size-9 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-[18px]'

/** Một loại giấy tờ, mỗi loại một tệp PDF hoặc ảnh (DocRow trong prototype NCC). */
export function DocumentRow({ slot, file, locked, error, onChange }: DocumentRowProps) {
  const upload = useUploadVendorFile('VENDOR_DOCUMENT')
  const [fileError, setFileError] = useState('')
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isImage = file?.mimeType.startsWith('image/')

  async function handleFile(f: File | undefined) {
    if (!f) return
    if (!DOCUMENT_TYPES.includes(f.type)) return setFileError('Định dạng không hỗ trợ, dùng PDF, JPG, PNG hoặc WEBP.')
    if (f.size > MAX_FILE_SIZE) return setFileError('Tệp vượt 10MB.')
    setFileError('')
    try {
      onChange({ type: slot.type, ...(await upload.mutateAsync(f)) })
    } catch (e) {
      setFileError((e as Error).message)
    }
  }

  const message = fileError || (!file ? error : undefined)

  return (
    <div
      className={cn(
        'mb-2.5 flex min-w-0 items-center gap-3 rounded-md border border-line px-3.5 py-3 max-sm:flex-wrap',
        file ? 'bg-surface' : 'border-dashed',
        message && 'border-destructive',
      )}
    >
      <span
        className={cn(
          'relative grid size-9 flex-none place-items-center rounded-sm bg-surface-2 text-muted-foreground [&_svg]:size-[17px]',
          file && (isImage ? 'bg-info-soft text-info' : 'bg-warn-soft text-warn'),
        )}
      >
        {isImage ? <ImageIcon /> : <FileText />}
        {file && !isImage && (
          <em className="absolute -right-1.5 -bottom-1 rounded-[3px] bg-warn px-[3px] text-[9px] font-bold text-white not-italic">PDF</em>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <strong className="text-[13.5px] font-medium">{slot.label} *</strong>
        <p className="text-[12.5px] [overflow-wrap:anywhere] text-muted-foreground">
          {file ? (
            <>
              <span className="text-ink">{file.fileName}</span> · {formatFileSize(file.size)}
            </>
          ) : (
            'Chưa có tệp · PDF hoặc ảnh (JPG, PNG, WEBP), tối đa 10MB'
          )}
        </p>
        {message && (
          <span role="alert" data-field-error className="mt-1 block text-[12.5px] text-destructive">
            {message}
          </span>
        )}
      </div>

      <div className="ml-auto flex flex-none items-center gap-1">
        {file ? (
          <>
            <button type="button" className={iconBtn} aria-label={`Xem ${slot.label}`} title="Xem giấy tờ" onClick={() => setPreview(true)}>
              <Eye />
            </button>
            {!locked && (
              <button
                type="button"
                className={cn(iconBtn, 'hover:bg-warn-soft hover:text-warn')}
                aria-label={`Xóa tệp ${slot.label}`}
                title="Xóa tệp"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
              </button>
            )}
          </>
        ) : (
          !locked && (
            <label
              className={cn(
                'relative inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[13px] whitespace-nowrap hover:border-gold focus-within:outline-2 focus-within:outline-ring',
                upload.isPending && 'pointer-events-none opacity-60',
              )}
            >
              {upload.isPending ? <LoaderCircle className="size-[15px] animate-spin" /> : <Upload className="size-[15px]" />}
              {upload.isPending ? 'Đang tải…' : 'Tải lên'}
              <input
                type="file"
                accept={['.pdf', ...DOCUMENT_TYPES.filter((t) => t.startsWith('image/'))].join(',')}
                aria-label={`Tải ${slot.label}`}
                className="absolute size-px opacity-0"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          )
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        danger
        title="Xóa tệp giấy tờ?"
        confirmLabel="Xóa tệp"
        onConfirm={() => onChange(null)}
      >
        <p>
          Tệp <b>{file?.fileName}</b> sẽ bị gỡ khỏi mục {slot.label}. Đây là giấy tờ bắt buộc, bạn cần tải tệp mới trước khi gửi xác minh.
        </p>
      </ConfirmDialog>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-[860px]">
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">{file?.fileName}</DialogTitle>
            <DialogDescription>
              {slot.label} · {file && formatFileSize(file.size)} · chỉ phục vụ xét duyệt, không công khai
            </DialogDescription>
          </DialogHeader>
          {file &&
            (!file.url ? (
              <PreviewMessage text="Tệp mẫu, chưa có nội dung xem trước." />
            ) : isImage ? (
              <img src={file.url} alt={file.fileName} className="mx-auto max-h-[70dvh] rounded-md object-contain" />
            ) : (
              <PreviewMessage text="Tệp PDF đã tải lên.">
                <Button asChild variant="outline">
                  <a href={file.url} target="_blank" rel="noreferrer">
                    Mở tệp trong tab mới
                  </a>
                </Button>
              </PreviewMessage>
            ))}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PreviewMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2.5 p-[30px] text-center text-muted-foreground">
      <FileText className="size-[34px] text-gold" />
      <p>{text}</p>
      {children}
    </div>
  )
}
