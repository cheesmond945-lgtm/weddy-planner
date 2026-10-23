import { FileText, LoaderCircle, Paperclip, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { VendorFile } from '@/types/vendor'
import { DOCUMENT_TYPES, formatFileSize, MAX_FILE_SIZE } from '../constants'
import { useUploadVendorFile } from '../hooks'

interface ProofFileFieldProps {
  value: VendorFile | null
  onChange: (file: VendorFile | null) => void
  /** Lỗi từ form (ví dụ "Cần tải tệp minh chứng") */
  error?: string
  disabled?: boolean
}

/** Chọn và tải một tệp minh chứng (ảnh chuyển khoản, phiếu thu…): PDF hoặc ảnh, tối đa 10MB. */
export function ProofFileField({ value, onChange, error, disabled }: ProofFileFieldProps) {
  const upload = useUploadVendorFile('PAYMENT_PROOF')
  const [fileError, setFileError] = useState('')

  async function pick(f: File | undefined) {
    if (!f) return
    if (!DOCUMENT_TYPES.includes(f.type)) return setFileError('Định dạng không hỗ trợ, dùng PDF, JPG, PNG hoặc WEBP.')
    if (f.size > MAX_FILE_SIZE) return setFileError('Tệp vượt 10MB.')
    setFileError('')
    try {
      onChange(await upload.mutateAsync(f))
    } catch (e) {
      setFileError((e as Error).message)
    }
  }

  const message = fileError || error
  return (
    <div className="grid gap-1.5">
      {value ? (
        <div className="flex min-w-0 items-center gap-2.5 rounded-sm border border-line px-3 py-2 text-[13px]">
          <FileText className="size-4 flex-none text-gold" />
          <span className="min-w-0 flex-1 truncate">{value.fileName}</span>
          <span className="text-muted-foreground">{formatFileSize(value.size)}</span>
          {!disabled && (
            <button type="button" aria-label="Bỏ tệp minh chứng" onClick={() => onChange(null)} className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={cn(
            'relative inline-flex h-[34px] w-fit cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[13px] hover:border-gold focus-within:outline-2 focus-within:outline-ring',
            (upload.isPending || disabled) && 'pointer-events-none opacity-60',
            message && 'border-destructive',
          )}
        >
          {upload.isPending ? <LoaderCircle className="size-[15px] animate-spin" /> : <Paperclip className="size-[15px]" />}
          {upload.isPending ? 'Đang tải…' : 'Chọn tệp'}
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            aria-label="Tải tệp minh chứng"
            disabled={disabled}
            className="absolute size-px opacity-0"
            onChange={(e) => {
              void pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      )}
      {message && (
        <span role="alert" data-field-error className="text-[13px] text-destructive">
          {message}
        </span>
      )}
    </div>
  )
}
