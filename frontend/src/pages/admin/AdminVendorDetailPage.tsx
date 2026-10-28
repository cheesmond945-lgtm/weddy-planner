import { Check, Eye, EyeOff, LoaderCircle, MessageSquareWarning } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/features/adminShared/format'
import { AdminConfirm } from '@/features/adminShared/components/AdminConfirm'
import { ReviewKindBadge } from '@/features/adminVendors/components/ReviewKindBadge'
import { useAdminVendor, useReviewVendor, useToggleVendorHidden } from '@/features/adminVendors/hooks'
import { controlClass, Notice } from '@/features/vendors/components/FormParts'
import { ProfileStatusBadge } from '@/features/vendors/components/ProfileStatus'
import { VendorProfileForm } from '@/features/vendors/components/VendorProfileForm'
import { documentSlotsOf, PHOTO_LABEL, photosRequired } from '@/features/vendors/constants'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminVendor } from '@/types/admin'
import type { VendorProfile } from '@/types/vendor'

/** Hồ sơ NCC nhìn từ Admin: cùng kiểu dữ liệu với trang Hồ sơ của NCC để dùng chung form (bố cục y hệt, chỉ đọc). */
function toProfile(v: AdminVendor): VendorProfile {
  return {
    id: v.id,
    status: v.status,
    businessName: v.businessName,
    taxCode: v.taxCode,
    representativeName: v.representativeName,
    category: v.category,
    commissionRate: null,
    verifiedCategory: v.status === 'VERIFIED' ? v.category : null,
    province: v.province,
    ward: v.ward,
    address: v.address,
    googleMapsUrl: v.googleMapsUrl,
    openTime: v.openTime,
    closeTime: v.closeTime,
    description: v.description,
    documents: v.documents,
    photos: v.photos,
    reviewNote: v.reviewNote,
    pendingReview: false,
    revisionRequested: false,
    submittedAt: v.submittedAt,
    updatedAt: v.submittedAt ?? '',
  }
}

/**
 * Chi tiết hồ sơ nhà cung cấp (Admin): dùng đúng form của trang Hồ sơ NCC ở chế độ chỉ đọc.
 * Hồ sơ đang chờ duyệt: Phê duyệt (sang Đã duyệt) hoặc Yêu cầu chỉnh sửa / bổ sung kèm lý do.
 */
export default function AdminVendorDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: v, isPending, isError, error, refetch } = useAdminVendor(id)
  const review = useReviewVendor()
  const toggleHidden = useToggleVendorHidden()
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [confirm, setConfirm] = useState<'approve' | 'revision' | 'hide' | 'unhide' | null>(null)

  if (isPending) return <div aria-busy="true" aria-label="Đang tải hồ sơ" className="mx-auto h-[560px] max-w-[980px] animate-pulse rounded-md bg-muted" />
  if (isError || !v) {
    return (
      <div className="mx-auto max-w-[980px]">
        <EmptyState
          title="Chưa mở được hồ sơ"
          description={error?.message}
          action={
            <div className="flex gap-2">
              <Button onClick={() => refetch()}>Thử lại</Button>
              <Button asChild variant="outline">
                <Link to={paths.admin.vendors}>Về danh sách</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const slots = documentSlotsOf(v.category.slug)
  const missing = slots.filter((s) => s.required && !v.documents.some((d) => d.type === s.type)).map((s) => s.label)
  if (photosRequired(v.category.slug) && !v.photos.length) missing.push(PHOTO_LABEL)
  const pending = v.status === 'PENDING'
  const isUpdate = v.reviewKind === 'UPDATE'

  function openRevisionConfirm() {
    if (!note.trim()) return setFormError('Nhập lý do chỉnh sửa / bổ sung để nhà cung cấp biết cần sửa gì.')
    setFormError('')
    setConfirm('revision')
  }
  /** Sau khi Admin xác nhận trong popup: gửi duyệt hoặc yêu cầu chỉnh sửa, xong về danh sách. */
  function submitReview() {
    const done = { onSuccess: () => navigate(paths.admin.vendors), onError: (e: Error) => (setConfirm(null), setFormError(e.message)) }
    if (confirm === 'approve') review.mutate({ id: v!.id }, done)
    else review.mutate({ id: v!.id, note: note.trim() }, done)
  }

  /** Sau khi Admin xác nhận trong popup: ẩn hoặc hiện lại hồ sơ, ở lại trang để thấy trạng thái mới. */
  function submitToggleHidden() {
    toggleHidden.mutate({ id: v!.id, hide: confirm === 'hide' }, { onSuccess: () => setConfirm(null), onError: (e: Error) => (setConfirm(null), setFormError(e.message)) })
  }

  // Hồ sơ đã duyệt: nút Ẩn hồ sơ; hồ sơ đang ẩn: nút Hiện lại. Chỉ Admin có các nút này.
  const hideActions =
    (v.status === 'VERIFIED' || v.status === 'HIDDEN') && (
      <div className="grid gap-3">
        {formError && (
          <p role="alert" className="text-[13px] text-destructive">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:[&>button]:flex-1">
          {v.status === 'VERIFIED' ? (
            <Button type="button" variant="outline" className="h-10 border-warn/50 text-warn hover:bg-warn-soft" onClick={() => (setFormError(''), setConfirm('hide'))} disabled={toggleHidden.isPending}>
              <EyeOff />
              Ẩn hồ sơ
            </Button>
          ) : (
            <Button type="button" variant="success" className="h-10" onClick={() => (setFormError(''), setConfirm('unhide'))} disabled={toggleHidden.isPending}>
              <Eye />
              Hiện lại hồ sơ
            </Button>
          )}
        </div>
      </div>
    )

  const actions = pending ? (
    <div className="grid gap-3">
      {asking && (
        <label className="grid gap-1.5 rounded-md border border-warn/35 bg-warn-soft px-4 py-3.5">
          <span className="text-[13px] font-medium text-warn">Lý do chỉnh sửa / bổ sung *</span>
          <textarea
            rows={4}
            autoFocus
            maxLength={1000}
            className={cn(controlClass, 'h-auto bg-surface py-2.5 leading-relaxed')}
            placeholder="VD: Giấy PCCC đã hết hạn, vui lòng tải bản còn hiệu lực."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      {formError && (
        <p role="alert" className="text-[13px] text-destructive">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:[&>button]:flex-1">
        {asking ? (
          <>
            <Button type="button" variant="outline" className="h-10 border-line-strong" onClick={() => (setAsking(false), setFormError(''))} disabled={review.isPending}>
              Quay lại
            </Button>
            <Button type="button" variant="outline" className="h-10 border-warn/50 text-warn hover:bg-warn-soft" onClick={openRevisionConfirm} disabled={review.isPending}>
              {review.isPending ? <LoaderCircle className="animate-spin" /> : <MessageSquareWarning />}
              Gửi yêu cầu chỉnh sửa / bổ sung
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" className="h-10 border-warn/50 text-warn hover:bg-warn-soft" onClick={() => setAsking(true)} disabled={review.isPending}>
              <MessageSquareWarning />
              Yêu cầu chỉnh sửa / bổ sung
            </Button>
            <Button type="button" variant="success" className="h-10" onClick={() => setConfirm('approve')} disabled={review.isPending}>
              {review.isPending ? <LoaderCircle className="animate-spin" /> : <Check />}
              Phê duyệt
            </Button>
          </>
        )}
      </div>
    </div>
  ) : (
    hideActions
  )

  return (
    <div className="mx-auto max-w-[980px]">
      <PageTitle
        title="Hồ sơ nhà cung cấp"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProfileStatusBadge status={v.status} large />
            {v.reviewKind && <ReviewKindBadge kind={v.reviewKind} />}
          </div>
        }
      />

      {isUpdate && pending && (
        <Notice tone="info" title="Hồ sơ đã duyệt, nhà cung cấp vừa gửi cập nhật.">
          Dữ liệu mới đã được ghi vào hồ sơ và vẫn đang hiển thị. Hợp lệ thì phê duyệt; không hợp lệ thì yêu cầu chỉnh sửa (hồ sơ vẫn hiển thị trong lúc nhà cung cấp chỉnh sửa; vi phạm nghiêm trọng thì khóa tài khoản ở mục Người dùng).
        </Notice>
      )}
      {pending && v.lastRevision?.note && (
        <Notice tone="warn" title={`Hồ sơ đã gửi lại sau lần yêu cầu chỉnh sửa trước${v.lastRevision.reviewedAt ? ` (${formatDateTime(v.lastRevision.reviewedAt)})` : ''}`}>
          <p>
            <b>Lý do lần trước:</b> {v.lastRevision.note}
          </p>
          <p>Đối chiếu xem nhà cung cấp đã sửa đúng các mục này chưa.</p>
        </Notice>
      )}
      {v.status === 'NEEDS_REVISION' && v.reviewNote && (
        <Notice tone="warn" title="Đã yêu cầu nhà cung cấp chỉnh sửa / bổ sung">
          <p>
            <b>Lý do:</b> {v.reviewNote}
          </p>
        </Notice>
      )}
      {v.status === 'HIDDEN' && (
        <Notice tone="warn" title="Hồ sơ đang được ẩn">
          Hồ sơ và toàn bộ gói dịch vụ của nhà cung cấp không còn hiển thị với khách. Nhà cung cấp vẫn đăng nhập để hoàn thành đơn đã cọc và thanh toán hoa hồng. Bấm “Hiện lại hồ sơ” để hiển thị lại.
        </Notice>
      )}
      {pending && missing.length > 0 && (
        <Notice tone="warn" title={`Hồ sơ còn thiếu: ${missing.join(', ')}.`}>
          Cân nhắc yêu cầu chỉnh sửa / bổ sung trước khi phê duyệt.
        </Notice>
      )}

      <VendorProfileForm profile={toProfile(v)} reviewMode actions={actions} />

      <AdminConfirm
        open={confirm === 'hide'}
        onOpenChange={(o) => !o && !toggleHidden.isPending && setConfirm(null)}
        icon={EyeOff}
        confirmIcon={EyeOff}
        title="Ẩn hồ sơ này?"
        confirmLabel="Ẩn hồ sơ"
        danger
        pending={toggleHidden.isPending}
        notice="Toàn bộ gói dịch vụ của nhà cung cấp cũng ngừng hiển thị với khách, khách không đặt cọc được đơn mới. Các đơn đã cọc và hoa hồng vẫn xử lý bình thường. Nhà cung cấp sẽ nhận được thông báo."
        onConfirm={submitToggleHidden}
      >
        Hồ sơ của <strong className="text-ink">{v.businessName}</strong> sẽ chuyển sang trạng thái Đã ẩn.
      </AdminConfirm>

      <AdminConfirm
        open={confirm === 'unhide'}
        onOpenChange={(o) => !o && !toggleHidden.isPending && setConfirm(null)}
        icon={Eye}
        confirmIcon={Eye}
        title="Hiện lại hồ sơ này?"
        confirmLabel="Hiện lại"
        pending={toggleHidden.isPending}
        notice="Hồ sơ và các gói dịch vụ sẽ hiển thị lại với khách như trước khi ẩn. Nhà cung cấp sẽ nhận được thông báo."
        onConfirm={submitToggleHidden}
      >
        Hồ sơ của <strong className="text-ink">{v.businessName}</strong> sẽ trở lại trạng thái Đã duyệt.
      </AdminConfirm>

      <AdminConfirm
        open={confirm === 'approve'}
        onOpenChange={(o) => !o && !review.isPending && setConfirm(null)}
        icon={Check}
        confirmIcon={Check}
        title="Phê duyệt hồ sơ này?"
        confirmLabel="Phê duyệt"
        pending={review.isPending}
        notice="Nhà cung cấp sẽ nhận được thông báo."
        onConfirm={submitReview}
      >
        {isUpdate ? 'Bản cập nhật của' : 'Hồ sơ của'} <strong className="text-ink">{v.businessName}</strong> sẽ được xác nhận hợp lệ và chuyển sang trạng thái Đã duyệt.
      </AdminConfirm>

      <AdminConfirm
        open={confirm === 'revision'}
        onOpenChange={(o) => !o && !review.isPending && setConfirm(null)}
        icon={MessageSquareWarning}
        confirmIcon={MessageSquareWarning}
        title="Gửi yêu cầu chỉnh sửa / bổ sung?"
        confirmLabel="Gửi yêu cầu"
        pending={review.isPending}
        notice={isUpdate ? 'Hồ sơ vẫn hiển thị với khách trong lúc nhà cung cấp chỉnh sửa. Nhà cung cấp sẽ nhận được thông báo kèm lý do.' : 'Hồ sơ chuyển sang Cần chỉnh sửa / bổ sung. Nhà cung cấp sẽ nhận được thông báo kèm lý do.'}
        onConfirm={submitReview}
      >
        Yêu cầu <strong className="text-ink">{v.businessName}</strong> chỉnh sửa với lý do: “{note.trim()}”.
      </AdminConfirm>
    </div>
  )
}
