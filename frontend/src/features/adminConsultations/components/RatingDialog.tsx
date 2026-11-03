import { CircleCheck, LoaderCircle, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { AdminConfirm } from '@/features/adminShared/components/AdminConfirm'
import { controlClass } from '@/features/vendors/components/FormParts'
import { PanelDialog } from '@/features/vendorOrders/components/PanelDialog'
import { cn } from '@/lib/utils'
import type { ConsultationRequest, Qualification } from '@/types/admin'
import { useUpdateConsultation } from '../hooks'

interface RatingDialogProps {
  item: ConsultationRequest
  target: Qualification
  onClose: () => void
}

/**
 * Xác nhận đánh giá nhà cung cấp: đạt và đặt lại chỉ cần xác nhận một bước,
 * chưa đạt bắt buộc nhập ghi chú (lưu vào ghi chú của yêu cầu).
 */
export function RatingDialog({ item, target, onClose }: RatingDialogProps) {
  const update = useUpdateConsultation()
  const [reason, setReason] = useState(item.qualification === 'UNQUALIFIED' ? (item.note ?? '') : '')
  const [error, setError] = useState('')

  function confirm() {
    if (target === 'UNQUALIFIED' && !reason.trim()) return setError('Nhập ghi chú khi đánh giá chưa đạt.')
    update.mutate(
      { id: item.id, body: { qualification: target, ...(target === 'UNQUALIFIED' && { note: reason }) } },
      {
        onSuccess: () => {
          toast(target === 'QUALIFIED' ? `Đã đánh giá ${item.brandName} đạt tiêu chuẩn.` : target === 'UNQUALIFIED' ? `Đã đánh giá ${item.brandName} chưa đạt.` : `Đã đặt lại đánh giá của ${item.brandName}.`)
          onClose()
        },
      },
    )
  }

  if (target === 'UNQUALIFIED') {
    return (
      <PanelDialog
        open
        size="md"
        onRequestClose={() => !update.isPending && onClose()}
        title={`Chưa đạt: ${item.brandName}`}
        subtitle="Ghi chú nội bộ, hiện trên thẻ yêu cầu. Nhà cung cấp không nhìn thấy."
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
              Hủy
            </Button>
            <Button onClick={confirm} disabled={update.isPending}>
              {update.isPending && <LoaderCircle className="animate-spin" />}
              Xác nhận chưa đạt
            </Button>
          </>
        }
      >
        <label className="grid gap-1.5">
          <span className="text-[13px] font-medium">
            Ghi chú <b className="text-destructive">*</b>
          </span>
          <textarea
            rows={5}
            autoFocus
            maxLength={1000}
            aria-invalid={error ? true : undefined}
            className={cn(controlClass, 'h-auto py-2.5 leading-relaxed')}
            placeholder="VD: Chưa có giấy phép kinh doanh, hồ sơ năng lực chưa đủ."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError('')
            }}
          />
          {error && (
            <span role="alert" className="text-[13px] text-destructive">
              {error}
            </span>
          )}
        </label>
      </PanelDialog>
    )
  }

  const reset = target === 'UNRATED'
  return (
    <AdminConfirm
      open
      onOpenChange={(o) => !o && onClose()}
      icon={reset ? RotateCcw : CircleCheck}
      title={reset ? 'Đặt lại đánh giá?' : 'Xác nhận đạt tiêu chuẩn?'}
      confirmLabel={reset ? 'Đặt lại' : 'Xác nhận đạt'}
      pending={update.isPending}
      onConfirm={confirm}
      notice={reset ? undefined : 'Sau khi đạt, bạn có thể tạo tài khoản nhà cung cấp từ thông tin trong yêu cầu này.'}
    >
      {reset ? (
        <>
          Đánh giá của <b>{item.brandName}</b> sẽ quay về "Chưa đánh giá".
        </>
      ) : (
        <>
          Bạn chắc chắn muốn đánh giá <b>{item.brandName}</b> là <b>đạt tiêu chuẩn</b>?
        </>
      )}
    </AdminConfirm>
  )
}
