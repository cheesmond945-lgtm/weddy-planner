import { useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'

/** Ghi âm tối đa 5 phút (khớp backend MAX_AUDIO_SECONDS), tới hạn thì tự dừng và gửi */
export const MAX_RECORD_SECONDS = 300

/** Kiểu ghi âm trình duyệt hỗ trợ: Chrome / Firefox ghi webm hoặc ogg, Safari ghi mp4 */
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']
const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }

export interface VoiceClip {
  blob: Blob
  name: string
  durationSec: number
}

/**
 * Ghi âm tin nhắn thoại bằng MediaRecorder: start() xin quyền micro rồi ghi, stop() dừng và gọi `onDone` với bản ghi, cancel() bỏ bản ghi.
 * Rời khung chat khi đang ghi thì tự bỏ và tắt micro.
 */
export function useVoiceRecorder(onDone: (clip: VoiceClip) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)
  const startedAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const done = useRef(onDone)
  done.current = onDone

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  async function start() {
    if (recording) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast('Không dùng được micro. Hãy cho phép trình duyệt truy cập micro rồi thử lại.')
      return
    }
    const mimeType = CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      window.clearInterval(timer.current)
      setRecording(false)
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
      if (cancelled.current || !chunks.length) return
      const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0]
      done.current({ blob: new Blob(chunks, { type }), name: `ghi-am.${EXT[type] ?? 'webm'}`, durationSec })
    }
    cancelled.current = false
    startedAt.current = Date.now()
    setSeconds(0)
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000)
      setSeconds(s)
      if (s >= MAX_RECORD_SECONDS && rec.state === 'recording') rec.stop()
    }, 250)
    recorder.current = rec
    rec.start()
    setRecording(true)
  }

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }
  const cancel = () => {
    cancelled.current = true
    stop()
  }

  useEffect(
    () => () => {
      cancelled.current = true
      if (recorder.current?.state === 'recording') recorder.current.stop()
      window.clearInterval(timer.current)
    },
    [],
  )

  return { supported, recording, seconds, start, stop, cancel }
}
