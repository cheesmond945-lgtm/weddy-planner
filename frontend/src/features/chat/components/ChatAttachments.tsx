import { Download, FileText, Loader2, Mic, Paperclip, Send, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Lightbox } from '@/features/catalog/components/GalleryDialog'
import { cn } from '@/lib/utils'
import type { MessageAttachment } from '@/types/chat'
import { MAX_RECORD_SECONDS, useVoiceRecorder, type VoiceClip } from '../useVoiceRecorder'

/** Định dạng chọn được ở nút đính kèm (khớp danh sách backend cho phép) */
const ACCEPT = 'image/*,audio/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip'

const sizeText = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Nội dung tin đính kèm: ảnh (bấm mở ảnh gốc), ghi âm (trình phát), video (trình phát), tệp khác (thẻ tên + dung lượng + tải về).
 * `mine` đổi màu thẻ tệp theo phía người gửi.
 */
export function AttachmentContent({ attachment: a, mine }: { attachment: MessageAttachment; mine: boolean }) {
  if (!a.url) return <p className="rounded-[16px] bg-bg px-3.5 py-2.5 text-[13px] text-muted-foreground">Không tải được tệp {a.name}</p>
  if (a.mime.startsWith('image/')) return <ImageAlbum images={[a]} />

  if (a.mime.startsWith('audio/')) {
    return (
      <div className={cn('flex items-center gap-2 rounded-[20px] px-2.5 py-1.5', mine ? 'bg-primary/15' : 'bg-bg')}>
        <audio controls preload="metadata" src={a.url} aria-label="Tin nhắn thoại" className="h-9 w-[240px] max-w-full" />
        {a.duration ? <span className="text-[11.5px] text-muted-foreground tabular-nums">{clock(a.duration)}</span> : null}
      </div>
    )
  }
  if (a.mime.startsWith('video/')) {
    return <video controls preload="metadata" src={a.url} aria-label={a.name} className="max-h-72 max-w-full rounded-[16px] border border-line" />
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download={a.name}
      className={cn('flex max-w-[320px] items-center gap-3 rounded-[16px] border px-3.5 py-2.5 text-[13px] hover:border-gold-500', mine ? 'border-primary/30 bg-primary/10' : 'border-line bg-bg')}
    >
      <FileText className="size-8 flex-none text-gold-700" strokeWidth={1.5} aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block truncate font-semibold">{a.name}</b>
        <span className="text-[12px] text-muted-foreground">{sizeText(a.size)}</span>
      </span>
      <Download className="size-4 flex-none text-muted-foreground" aria-label="Tải về" />
    </a>
  )
}

/**
 * Ảnh trong chat: một ảnh thì hiện nguyên ảnh; nhiều ảnh gửi liền nhau (album, xem albums.ts) thì xếp chồng lệch nhau như album, kèm số ảnh.
 * Bấm vào mở trình xem phóng to ngay trong trang (không chuyển trang).
 */
export function ImageAlbum({ images }: { images: MessageAttachment[] }) {
  const shown = images.filter((i) => i.url)
  const [open, setOpen] = useState<number | null>(null)
  if (!shown.length) return <p className="rounded-[16px] bg-bg px-3.5 py-2.5 text-[13px] text-muted-foreground">Không tải được ảnh</p>
  // Cùng trình xem ảnh với trang dịch vụ (nền tối, ‹ ›, phím mũi tên, vuốt ngang)
  const viewer = <Lightbox title={shown.length > 1 ? `Album ${shown.length} ảnh` : shown[0].name} images={shown.map((i) => i.url!)} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />

  if (shown.length === 1) {
    return (
      <>
        <button type="button" aria-label={`Phóng to ảnh ${shown[0].name}`} onClick={() => setOpen(0)} className="block cursor-zoom-in">
          <img src={shown[0].url!} alt={shown[0].name} loading="lazy" className="max-h-72 max-w-full rounded-[16px] border border-line object-cover" />
        </button>
        {viewer}
      </>
    )
  }

  // Album: tối đa 3 lớp, lớp sau xoay lệch và lùi ra sau; ảnh đầu nằm trên cùng
  const layers = shown.slice(0, 3)
  const tilt = ['rotate-0', '-rotate-6 -translate-x-3', 'rotate-6 translate-x-3']
  return (
    <>
      <button type="button" aria-label={`Xem album ${shown.length} ảnh`} onClick={() => setOpen(0)} className="relative m-3 block size-[200px] cursor-zoom-in max-[640px]:size-[170px]">
        {layers
          .map((img, i) => (
            <img
              key={img.url}
              src={img.url!}
              alt=""
              loading="lazy"
              className={cn('absolute inset-0 size-full rounded-[16px] border-2 border-surface object-cover shadow-md transition-transform', tilt[i])}
              style={{ zIndex: layers.length - i }}
            />
          ))
          .reverse()}
        <span className="absolute right-2 bottom-2 z-10 rounded-pill bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white">{shown.length} ảnh</span>
      </button>
      {viewer}
    </>
  )
}

const toolBtn = 'grid size-10 flex-none place-items-center rounded-full text-muted-foreground transition-colors hover:bg-bg hover:text-ink disabled:opacity-50 [&_svg]:size-[19px]'

/**
 * Nút đính kèm (ảnh / tệp, chọn được nhiều) và ghi âm cạnh ô nhập, như Messenger. Đang ghi âm thì cả hàng thành thanh ghi âm
 * (chấm đỏ, thời gian, Hủy, Gửi) thay cho ô nhập: `children` (ô nhập + nút gửi) chỉ hiện khi không ghi.
 */
export function ComposerTools({
  onFiles,
  onVoice,
  sending,
  className,
  children,
}: {
  onFiles: (files: File[]) => void
  onVoice: (clip: VoiceClip) => void
  /** Đang upload tệp: khoá nút và hiện vòng quay */
  sending: boolean
  className?: string
  children: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const voice = useVoiceRecorder(onVoice)

  if (voice.recording) {
    return (
      <div className={cn('flex items-center gap-2.5', className)} role="status" aria-label="Đang ghi âm">
        <button type="button" aria-label="Hủy ghi âm" title="Hủy" onClick={voice.cancel} className={toolBtn}>
          <Trash2 />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-pill bg-bg px-[18px] py-[13px] text-[14px]">
          <span aria-hidden className="size-2.5 flex-none animate-pulse rounded-full bg-destructive" />
          <span className="tabular-nums">{clock(voice.seconds)}</span>
          <span className="truncate text-muted-foreground">Đang ghi âm… (tối đa {MAX_RECORD_SECONDS / 60} phút)</span>
        </div>
        <button type="button" aria-label="Dừng và gửi ghi âm" title="Gửi" onClick={voice.stop} className="grid size-12 flex-none place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90">
          <Send className="size-[19px]" />
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      <button type="button" aria-label="Gửi ảnh hoặc tệp" title="Gửi ảnh / tệp" disabled={sending} onClick={() => input.current?.click()} className={toolBtn}>
        {sending ? <Loader2 className="animate-spin" /> : <Paperclip />}
      </button>
      {voice.supported && (
        <button type="button" aria-label="Ghi âm" title="Ghi âm" disabled={sending} onClick={() => void voice.start()} className={toolBtn}>
          <Mic />
        </button>
      )}
      {children}
    </div>
  )
}
