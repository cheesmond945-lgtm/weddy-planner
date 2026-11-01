import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/date'
import type { DateChangePreview } from '@/types/wedding'

interface Props {
  /** Ngày cưới mới đang xem trước; null thì đóng */
  newDate: string | null
  preview: DateChangePreview | null
  pending: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
  /** Nhắn NCC cập nhật đơn lệch ngày */
  onMessageVendor: (serviceId: string, orderCode: string, eventDate: string) => void
}

/** Xem trước khi đổi ngày cưới: bảng hạn cũ → mới, cảnh báo đơn đã cọc. Xác nhận mới lưu ngày cưới và cập nhật hạn. */
export function DateChangePreviewDialog({ newDate, preview, pending, error, onCancel, onConfirm, onMessageVendor }: Props) {
  return (
    <Dialog open={!!newDate && !!preview} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Đổi ngày cưới sang {newDate ? formatDate(newDate) : ''}</DialogTitle>
          <DialogDescription>
            {preview && preview.count > 0 ? (
              <>
                Đổi ngày cưới sẽ cập nhật hạn của <b className="font-semibold text-ink">{preview.count} việc chưa xong</b>. Việc đã xong, việc chi tiết của dịch vụ đã đặt cọc và việc bạn tự thêm giữ nguyên.
              </>
            ) : (
              'Không có việc chưa xong nào phải đổi hạn. Việc đã xong, việc chi tiết của dịch vụ đã đặt cọc và việc bạn tự thêm giữ nguyên.'
            )}
          </DialogDescription>
        </DialogHeader>

        {preview && preview.warnings.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Cảnh báo đơn">
            {preview.warnings.map((w) => (
              <li key={w.orderCode} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warn bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
                <span className="min-w-[220px] flex-1">{w.message}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => onMessageVendor(w.serviceId, w.orderCode, w.eventDate)}>
                  Nhắn NCC
                </Button>
              </li>
            ))}
          </ul>
        )}

        {preview && preview.count > 0 && (
          <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-surface text-left text-[12px] tracking-[0.06em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Công việc</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Hạn cũ</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Hạn mới</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2">{c.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground line-through">{formatDate(c.oldDate)}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{formatDate(c.newDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Hủy
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
