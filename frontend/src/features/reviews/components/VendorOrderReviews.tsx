import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/features/catalog/components/StarRating'
import { formatDayTime } from '@/features/vendorOrders/calc'
import type { VendorOrderReview } from '@/types/review'
import { useReplyReview, useVendorOrderReviews } from '../hooks'

/**
 * Trang chi tiết đơn của NCC: đánh giá của khách (đơn Hoàn thành) và ô phản hồi. NCC phản hồi MỘT lần, phản hồi hiện công khai dưới
 * đánh giá trên trang dịch vụ và khách được báo. Chưa có đánh giá thì không hiện gì.
 */
export function VendorOrderReviews({ orderId, completed }: { orderId: string; completed: boolean }) {
  const q = useVendorOrderReviews(orderId, completed)
  if (!completed || !q.data?.length) return null
  return (
    <section className="mt-5 rounded-[22px] border border-line bg-surface p-6 shadow-panel max-sm:p-4">
      <h2 className="mb-3 text-lg font-semibold">Đánh giá của khách</h2>
      <ul className="grid gap-4">
        {q.data.map((r) => (
          <ReviewRow key={r.orderItemId} orderId={orderId} item={r} />
        ))}
      </ul>
    </section>
  )
}

function ReviewRow({ orderId, item: { name, review: r } }: { orderId: string; item: VendorOrderReview }) {
  const [text, setText] = useState('')
  const reply = useReplyReview(orderId)
  return (
    <li className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StarRating value={r.rating} size={15} />
        <span className="text-[13px] text-muted-foreground">
          {name} · {formatDayTime(r.createdAt)}
        </span>
      </div>
      {r.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.tags.map((t) => (
            <span key={t} className="rounded-pill bg-gold-100 px-2.5 py-0.5 text-[12px] text-gold-800">
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap">{r.content}</p>
      {r.vendorReply ? (
        <div className="mt-3 rounded-md border-l-2 border-gold bg-surface-2 px-3 py-2 text-[13.5px]">
          <b className="font-semibold">Phản hồi của bạn</b> <span className="text-xs text-muted-foreground">{formatDayTime(r.vendorReply.repliedAt)}</span>
          <p className="mt-0.5 whitespace-pre-wrap">{r.vendorReply.content}</p>
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            rows={2}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Phản hồi đánh giá"
            placeholder="Cảm ơn khách, giải thích nếu có điểm chưa hài lòng... (phản hồi hiện công khai, chỉ gửi được một lần)"
            className="w-full rounded-sm border border-input bg-surface px-3 py-2 text-[14px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
          />
          <div className="mt-1.5 flex justify-end">
            <Button size="sm" disabled={text.trim().length < 2 || reply.isPending} onClick={() => reply.mutate({ reviewId: r.id, content: text.trim() })}>
              Gửi phản hồi
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
