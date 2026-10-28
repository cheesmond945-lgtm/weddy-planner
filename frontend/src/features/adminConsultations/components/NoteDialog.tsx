import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { controlClass } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import { PanelDialog } from '@/features/vendorOrders/components/PanelDialog'
import type { ConsultationRequest } from '@/types/admin'
import { useUpdateConsultation } from '../hooks'

/** Ghi chú nội bộ cho một yêu cầu tư vấn (chỉ Admin thấy). */
export function NoteDialog({ item, onClose }: { item: ConsultationRequest; onClose: () => void }) {
  const update = useUpdateConsultation()
  const [note, setNote] = useState(item.note ?? '')

  function save() {
    update.mutate(
      { id: item.id, body: { note } },
      {
        onSuccess: () => {
          toast('Đã lưu ghi chú.')
          onClose()
        },
      },
    )
  }

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={() => !update.isPending && onClose()}
      title={`Ghi chú: ${item.brandName}`}
      subtitle="Ghi chú nội bộ, nhà cung cấp không nhìn thấy."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Hủy
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending && <LoaderCircle className="animate-spin" />}
            Lưu ghi chú
          </Button>
        </>
      }
    >
      <label className="grid gap-1.5">
        <span className="text-[13px] font-medium">Nội dung ghi chú</span>
        <textarea
          rows={6}
          autoFocus
          maxLength={1000}
          className={cn(controlClass, 'h-auto py-2.5 leading-relaxed')}
          placeholder="VD: Đã gọi lần 1, hẹn gửi hồ sơ năng lực trước thứ 6."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <span className="text-right text-[12px] text-muted-foreground tabular-nums">{note.length}/1000</span>
      </label>
    </PanelDialog>
  )
}
