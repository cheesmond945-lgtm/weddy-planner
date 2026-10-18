import { Check, MessageCircle, Plus } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/api'
import { chatApi } from '@/api/chat'
import { weddingsApi } from '@/api/weddings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ServiceSummary } from '@/types/catalog'
import { usePlan, useRefreshPlanning } from './hooks'

// ---- Hộp hỏi thay dịch vụ (addPlan trong prototype) ----

interface ReplaceRequest {
  service: ServiceSummary
  existingServiceName: string
  confirm: () => Promise<void>
}

let replaceRequest: ReplaceRequest | null = null
const listeners = new Set<() => void>()
const setReplace = (r: ReplaceRequest | null) => {
  replaceRequest = r
  listeners.forEach((l) => l())
}

/** Đặt một lần trong CoupleLayout. */
export function ReplacePlanDialog() {
  const req = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => replaceRequest,
  )
  const [busy, setBusy] = useState(false)

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && !busy && setReplace(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thay dịch vụ trong hạng mục?</DialogTitle>
          <DialogDescription className="sr-only">Mỗi hạng mục chỉ chọn một dịch vụ</DialogDescription>
        </DialogHeader>
        {req && (
          <p>
            Kế hoạch đang có <b>{req.existingServiceName}</b> cho hạng mục {req.service.category.name.toLowerCase()}. Mỗi hạng mục chọn một
            dịch vụ. Bạn muốn thay bằng <b>{req.service.name}</b>?
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setReplace(null)}>
            Giữ nguyên
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await req?.confirm()
              setBusy(false)
              setReplace(null)
            }}
          >
            Thay dịch vụ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Thao tác ----

/** Thêm vào kế hoạch / mở tin nhắn với NCC; tự hỏi thay dịch vụ khi hạng mục đã có dịch vụ khác. */
export function usePlanActions() {
  const requireCouple = useRequireCouple()
  const refresh = useRefreshPlanning()
  const navigate = useNavigate()

  async function withReplace<T>(service: ServiceSummary, call: (replace: boolean) => Promise<T>, done: (result: T, replaced: boolean) => void) {
    try {
      done(await call(false), false)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_CATEGORY_TAKEN') {
        const { existingServiceName } = e.details as { existingServiceName: string }
        setReplace({
          service,
          existingServiceName,
          confirm: async () => {
            try {
              done(await call(true), true)
            } catch (err) {
              toast((err as Error).message)
            }
          },
        })
      } else {
        toast((e as Error).message)
      }
    }
  }

  return {
    addToPlan: (service: ServiceSummary) =>
      requireCouple(() =>
        withReplace(service, (replace) => weddingsApi.addPlanItem(service.id, replace), (_r, replaced) => {
          toast(replaced ? 'Đã thay dịch vụ trong kế hoạch' : 'Đã thêm vào kế hoạch')
          void refresh()
        }),
      ),

    /** openChat trong prototype: chưa có trong kế hoạch thì thêm vào, chuyển sang Đang trao đổi, mở khung chat. */
    openChat: (service: ServiceSummary) =>
      requireCouple(() =>
        withReplace(service, (replace) => chatApi.start(service.id, replace), (conv, replaced) => {
          if (replaced) toast('Đã thay dịch vụ trong kế hoạch')
          void refresh()
          navigate(`${paths.chat}?c=${conv.id}`)
        }),
      ),
  }
}

/** Dịch vụ đã có trong kế hoạch chưa (và trạng thái). */
export function usePlanItemOf(serviceId: string) {
  const { data } = usePlan()
  return data?.items.find((i) => i.service.id === serviceId) ?? null
}

// ---- Nút dùng lại ----

interface AddToPlanButtonProps {
  service: ServiceSummary
  /** icon: nút "+" trên thẻ dịch vụ; button: nút có chữ */
  variant?: 'icon' | 'button'
  /** Nhãn khi đã có: "Đã trong kế hoạch" (trang chi tiết) hoặc "Trong kế hoạch" */
  addedLabel?: string
  className?: string
  primary?: boolean
  size?: 'sm' | 'default' | 'lg'
}

export function AddToPlanButton({ service, variant = 'button', addedLabel = 'Trong kế hoạch', className, primary, size = 'sm' }: AddToPlanButtonProps) {
  const inPlan = !!usePlanItemOf(service.id)
  const { addToPlan } = usePlanActions()

  if (variant === 'icon') {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn('rounded-[9px]', className)}
        disabled={inPlan}
        aria-label={inPlan ? `${service.name} đã trong kế hoạch` : `Thêm ${service.name} vào kế hoạch`}
        title={inPlan ? 'Đã trong kế hoạch' : 'Thêm vào kế hoạch'}
        onClick={() => addToPlan(service)}
      >
        {inPlan ? <Check className="size-4" /> : <Plus className="size-4" />}
      </Button>
    )
  }
  return (
    <Button variant={primary && !inPlan ? 'default' : 'outline'} size={size} className={className} disabled={inPlan} onClick={() => addToPlan(service)}>
      {inPlan ? <Check strokeWidth={2.2} /> : <Plus />}
      {inPlan ? addedLabel : 'Thêm vào kế hoạch'}
    </Button>
  )
}

/** Nút "Nhắn tin với nhà cung cấp" / "Tiếp tục trao đổi". */
export function OpenChatButton({ service, className, size = 'sm', label }: { service: ServiceSummary; className?: string; size?: 'sm' | 'default' | 'lg'; label?: string }) {
  const item = usePlanItemOf(service.id)
  const { openChat } = usePlanActions()
  const text = label ?? (item && item.status !== 'PLANNED' ? 'Tiếp tục trao đổi' : 'Nhắn tin với nhà cung cấp')
  return (
    <Button size={size} className={className} onClick={() => openChat(service)}>
      <MessageCircle />
      {text}
    </Button>
  )
}
