import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { weddingsApi } from '@/api/weddings'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { Budget } from '@/types/wedding'
import type { SplitState } from './budgetSplit'
import { configBody, stateFromConfig } from './budgetSplitView'
import { planningKeys } from './hooks'

/** Lỗi mạng khi lưu thì thử lại sau các khoảng này (2 lần), vẫn lỗi thì trả về bản đã lưu */
export const SPLIT_AUTOSAVE = { RETRY_MS: [1000, 2000] }

export type SplitSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Cấu hình Tùy chỉnh đang sửa (mục 7). Mọi thao tác chỉ đổi bản nháp ở client (`update`), không gọi API; khách bấm "Lưu" (`save`)
 * mới gửi toàn bộ cấu hình kèm version, "Hủy" (`discard`) trả về bản đã lưu. `unsaved`: còn thay đổi chưa lưu.
 * Các lần lưu nối tiếp nhau (không chồng), mỗi lần mang seq tăng dần, chỉ áp dụng phản hồi mới nhất.
 * 422 / mất mạng (sau 2 lần thử lại): trả về cấu hình đã lưu gần nhất và báo. 409: nhận cấu hình mới nhất và báo.
 * Đổi mức chia hoặc rời màn hình khi còn thay đổi chưa lưu: gửi ngay (`flush`, keepalive khi rời trang) để không mất.
 */
export function useBudgetSplit(b: Budget) {
  const { user } = useAuth()
  const uid = user?.role === 'COUPLE' ? user.id : undefined
  const qc = useQueryClient()
  const server = b.preset === 'CUSTOM' ? b.split.config : null
  const serverKey = server ? JSON.stringify(server) : ''

  const [draft, setDraft] = useState<SplitState | null>(() => (server ? stateFromConfig(server, b) : null))
  const [status, setStatus] = useState<SplitSaveStatus>('idle')
  const [unsaved, setUnsaved] = useState(false)
  const draftRef = useRef(draft)
  const versionRef = useRef(server?.version ?? 0)
  /** Có thay đổi ở client chưa được backend xác nhận */
  const dirty = useRef(false)
  const markDirty = (v: boolean) => {
    dirty.current = v
    setUnsaved(v)
  }
  const inFlight = useRef(false)
  const again = useRef(false)
  const seq = useRef(0)

  // Dữ liệu backend đổi (tải lại, lưu xong, đổi mức chia…): nhận cấu hình mới khi không còn thay đổi đang chờ
  useEffect(() => {
    if (dirty.current || inFlight.current) return
    versionRef.current = server?.version ?? 0
    const next = server ? stateFromConfig(server, b) : null
    draftRef.current = next
    setDraft(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey, b.preset])

  // Hạng mục tự mở khóa khi nhóm đổi (backend áp onGroupChange lúc đọc)
  const noticeKey = b.split.notices.join('\n')
  useEffect(() => {
    for (const n of b.split.notices) toast(n, 6000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeKey])

  const apply = (budget: Budget) => {
    qc.setQueryData(planningKeys.budget(uid), budget)
    for (const k of ['overview', 'plan']) void qc.invalidateQueries({ queryKey: [k] })
  }

  async function send(keepalive = false): Promise<void> {
    const st = draftRef.current
    if (!st) return
    if (inFlight.current) {
      again.current = true
      return
    }
    inFlight.current = true
    const my = ++seq.current
    setStatus('saving')
    let result: Budget | null = null
    let error: unknown = null
    for (let attempt = 0; ; attempt++) {
      try {
        result = await weddingsApi.saveBudgetSplit(configBody(st, versionRef.current), keepalive)
        break
      } catch (e) {
        if (e instanceof ApiError && e.status === 0 && attempt < SPLIT_AUTOSAVE.RETRY_MS.length) {
          await sleep(SPLIT_AUTOSAVE.RETRY_MS[attempt])
          continue
        }
        error = e
        break
      }
    }
    inFlight.current = false
    if (result) {
      versionRef.current = result.split.config?.version ?? versionRef.current
      if (again.current) {
        // Khách đổi tiếp trong lúc đang lưu: gửi bản mới nhất với version vừa nhận
        again.current = false
        qc.setQueryData(planningKeys.budget(uid), result)
        return send()
      }
      if (my === seq.current) {
        markDirty(false)
        setStatus('saved')
        apply(result)
      }
      return
    }
    again.current = false
    markDirty(false)
    setStatus('error')
    const latest = error instanceof ApiError && error.status === 409 ? (error.details as { budget?: Budget } | undefined)?.budget : undefined
    if (latest) {
      apply(latest)
      toast('Tỷ lệ đã được cập nhật ở nơi khác.')
      return
    }
    // 422 hoặc lỗi mạng: trả về cấu hình đã lưu gần nhất
    const saved = qc.getQueryData<Budget>(planningKeys.budget(uid))
    const back = saved?.preset === 'CUSTOM' && saved.split.config ? stateFromConfig(saved.split.config, saved) : null
    draftRef.current = back
    setDraft(back)
    toast('Chưa lưu được thay đổi, đã trả về tỷ lệ trước đó.')
    if (error instanceof ApiError && error.status === 409) void qc.invalidateQueries({ queryKey: planningKeys.budget(uid) })
  }

  /** Đổi bản nháp (chưa lưu) */
  const update = (next: SplitState) => {
    markDirty(true)
    setStatus('idle')
    draftRef.current = next
    setDraft(next)
  }

  /** Nút "Lưu": gửi bản nháp hiện tại */
  const save = () => {
    if (dirty.current) void send()
  }

  /** Nút "Hủy": bỏ thay đổi chưa lưu, trả về cấu hình đã lưu */
  const discard = () => {
    if (inFlight.current) return
    const saved = qc.getQueryData<Budget>(planningKeys.budget(uid))
    const back = saved?.preset === 'CUSTOM' && saved.split.config ? stateFromConfig(saved.split.config, saved) : null
    markDirty(false)
    draftRef.current = back
    setDraft(back)
  }

  /** Gửi ngay thay đổi chưa lưu (trước khi đổi mức chia / rời trang) */
  const flush = (keepalive = false) => {
    if (dirty.current && !inFlight.current) void send(keepalive)
  }

  // Rời màn hình (đổi tab, đóng trang) khi còn thay đổi chưa lưu: gửi ngay
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    const onLeave = () => flushRef.current(true)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      flushRef.current(true)
    }
  }, [])

  return { draft, status, unsaved, update, save, discard, flush }
}
