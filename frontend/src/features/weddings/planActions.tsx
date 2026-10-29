import { Check, MessageCircle, Plus } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError } from '@/api'
import { catalogApi } from '@/api/catalog'
import { chatApi } from '@/api/chat'
import { weddingsApi } from '@/api/weddings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { CHAT_MODE, CHAT_PARAM, chatPanel } from '@/features/chat/chatPanel'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import type { ServiceDetail, ServiceSummary } from '@/types/catalog'
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

    /**
     * openChat trong prototype: chưa có trong kế hoạch thì thêm vào, chuyển sang Đang trao đổi, mở khung chat bên phải.
     * Chưa đăng nhập: đăng nhập xong quay lại trang với ?chat=<id> để tự mở lại khung chat (ChatPanelResume).
     * VITE_CHAT_MODE=zalo: mở Zalo của NCC thay vì chat trong WebPlan (xem features/chat/chatPanel.ts).
     */
    openChat: (service: ServiceSummary & Partial<Pick<ServiceDetail, 'workingHours' | 'contactPhone'>>, opts?: { draft?: string }) => {
      if (CHAT_MODE === 'zalo' && service.contactPhone) {
        openZalo(service.contactPhone, opts?.draft ?? `Chào ${service.name}, mình xem dịch vụ trên WebPlan và muốn được tư vấn thêm.`)
        return
      }
      return requireCouple(
        async () => {
          // Xem kế hoạch trước khi mở chat (mở chat sẽ tự thêm vào kế hoạch): đã thêm gói của NCC này thì soạn sẵn câu hỏi giá chốt
          const before = await weddingsApi
            .getPlan()
            .then((p) => p.items.find((i) => i.service.id === service.id) ?? null)
            .catch(() => null)
          const packageName = before?.packageName || null
          await withReplace(service, (replace) => chatApi.start(service.id, replace), (conv, replaced) => {
            if (replaced) toast('Đã thay dịch vụ trong kế hoạch')
            // Hạng mục đã có NCC khác chờ cọc / đã chốt: vẫn nhắn tin tư vấn được, NCC này không vào kế hoạch
            else if (!conv.planStatus) toast(`Hạng mục này đã có nhà cung cấp chờ cọc hoặc đã chốt nên ${service.name} không được thêm vào kế hoạch. Bạn vẫn nhắn tin tư vấn bình thường.`)
            void refresh()
            chatPanel.open({
              conversation: conv,
              draft: opts?.draft ?? (packageName ? `Mình muốn hỏi giá chốt cho gói ${packageName} ạ.` : ''),
              packageName,
              workingHours: service.workingHours,
            })
          })
        },
        { [CHAT_PARAM]: service.id },
      )
    },
  }
}

/** Phương án B: mở Zalo theo số điện thoại NCC. Zalo không nhận nội dung qua link nên chép tin vào bộ nhớ tạm để khách dán. */
function openZalo(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '84')
  void navigator.clipboard?.writeText(message).then(
    () => toast('Đã chép tin nhắn soạn sẵn, dán vào Zalo để gửi'),
    () => undefined,
  )
  window.open(`https://zalo.me/${encodeURIComponent(digits)}`, '_blank', 'noopener,noreferrer')
}

/**
 * Đăng nhập xong quay lại trang có ?chat=<id dịch vụ>: tự mở lại khung chat rồi bỏ tham số khỏi URL.
 * Đặt một lần trong CoupleLayout.
 */
export function ChatPanelResume() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const serviceId = params.get(CHAT_PARAM)
  const { openChat } = usePlanActions()
  const openRef = useRef(openChat)
  openRef.current = openChat

  useEffect(() => {
    if (!serviceId || user?.role !== 'COUPLE') return
    setParams(
      (p) => {
        p.delete(CHAT_PARAM)
        return p
      },
      { replace: true },
    )
    catalogApi.getService(serviceId).then(
      (service) => openRef.current(service),
      () => toast('Không mở được khung chat với nhà cung cấp'),
    )
  }, [serviceId, user, setParams])
  return null
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
      // aria-disabled thay cho disabled để rê chuột vẫn hiện chú thích "Đã trong kế hoạch"; vùng bấm 44×44
      <Button
        variant="outline"
        size="icon"
        className={cn('size-11 rounded-md', inPlan && 'cursor-default border-moss-700 bg-moss-700 text-white hover:border-moss-700', className)}
        aria-disabled={inPlan}
        aria-label={inPlan ? `${service.name} đã trong kế hoạch` : `Thêm ${service.name} vào kế hoạch`}
        title={inPlan ? 'Đã trong kế hoạch' : 'Thêm vào kế hoạch'}
        onClick={() => !inPlan && addToPlan(service)}
      >
        {inPlan ? <Check className="size-5" /> : <Plus className="size-5" />}
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

interface OpenChatButtonProps {
  service: ServiceSummary & Partial<Pick<ServiceDetail, 'workingHours' | 'contactPhone'>>
  className?: string
  label?: string
}

/** Nút "Nhắn tin với NCC": viền vàng đậm 1.5px, nền trong suốt, cao 44px; nút chính của trang vẫn là "Thêm vào kế hoạch". */
export function OpenChatButton({ service, className, label = 'Nhắn tin với NCC' }: OpenChatButtonProps) {
  const { openChat } = usePlanActions()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={async () => {
        setBusy(true)
        try {
          await openChat(service)
        } finally {
          setBusy(false)
        }
      }}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-md border-[1.5px] border-gold-700 bg-transparent px-4 text-sm font-semibold whitespace-nowrap text-gold-700 transition-colors hover:bg-gold-100 disabled:cursor-wait disabled:opacity-70',
        className,
      )}
    >
      <MessageCircle className="size-5" strokeWidth={1.5} aria-hidden />
      {label}
    </button>
  )
}
