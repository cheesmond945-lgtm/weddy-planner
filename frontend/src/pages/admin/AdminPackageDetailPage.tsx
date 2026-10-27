import { Check, LoaderCircle, MessageSquareWarning } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { useAdminPackage, useReviewPackage } from '@/features/adminCatalog/hooks'
import { AdminConfirm } from '@/features/adminShared/components/AdminConfirm'
import { ReviewKindBadge } from '@/features/adminVendors/components/ReviewKindBadge'
import { PackageEditor } from '@/features/vendorPackages/components/PackageEditor'
import { PackageStatusBadge } from '@/features/vendorPackages/components/PackageTable'
import { controlClass, Notice } from '@/features/vendors/components/FormParts'
import { formatDateTime } from '@/features/adminShared/format'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminPackage } from '@/types/admin'
import type { PackageStatus, VendorPackage } from '@/types/vendorPackage'

/** Gói nhìn từ Admin: cùng kiểu dữ liệu với trang gói của NCC để dùng chung form (bố cục y hệt, chỉ đọc). */
function toVendorPackage(p: AdminPackage): VendorPackage {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    status: p.status as PackageStatus,
    reviewNote: p.reviewNote,
    pendingUpdate: null,
    tags: p.tags,
    capacity: p.capacity,
    minTables: p.minTables ?? null,
    photos: p.photos.map((url, i) => ({ url, publicId: url, fileName: `Ảnh ${i + 1}`, size: 0, mimeType: 'image/jpeg' })),
    coverPublicId: p.photos[0] ?? null,
    updatedAt: p.submittedAt ?? '',
  }
}

/** Các mục bản cập nhật khác bản đang hiển thị với khách. */
function changesOf(p: AdminPackage) {
  const old = p.published
  if (!old) return []
  const list: string[] = []
  if (old.name !== p.name) list.push(`Tên gói: “${old.name}” → “${p.name}”`)
  if (old.price !== p.price) list.push(`Giá: ${formatMoney(old.price)} → ${formatMoney(p.price)}`)
  if (old.capacity !== p.capacity) list.push(`Sức chứa: ${old.capacity ? `${old.capacity} khách` : '—'} → ${p.capacity ? `${p.capacity} khách` : '—'}`)
  if ((old.minTables ?? null) !== (p.minTables ?? null)) list.push(`Số mâm tối thiểu: ${old.minTables ? `${old.minTables} mâm` : '—'} → ${p.minTables ? `${p.minTables} mâm` : '—'}`)
  if ([...old.tags].sort().join() !== [...p.tags].sort().join()) list.push(`Tags: ${old.tags.join(', ') || '—'} → ${p.tags.join(', ') || '—'}`)
  if (old.description !== p.description) list.push('Mô tả')
  if (old.photos.join() !== p.photos.join()) {
    const added = p.photos.filter((u) => !old.photos.includes(u)).length
    const removed = old.photos.filter((u) => !p.photos.includes(u)).length
    list.push(`Ảnh: ${[added && `thêm ${added}`, removed && `bỏ ${removed}`].filter(Boolean).join(', ') || 'đổi thứ tự / ảnh bìa'} (${old.photos.length} → ${p.photos.length} ảnh)`)
  }
  return list
}

/**
 * Chi tiết gói dịch vụ (Admin): dùng đúng form của trang gói NCC ở chế độ chỉ đọc.
 * Gói đã đăng có bản cập nhật: form hiện bản cập nhật, khách vẫn thấy bản đang đăng tới khi Admin phê duyệt.
 * Gói đang chờ duyệt: Phê duyệt (đăng công khai) hoặc Yêu cầu chỉnh sửa kèm lý do; đều có popup xác nhận.
 */
export default function AdminPackageDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: p, isPending, isError, error, refetch } = useAdminPackage(id)
  const review = useReviewPackage()
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [confirm, setConfirm] = useState<'approve' | 'revision' | null>(null)
  const pkg = useMemo(() => (p ? toVendorPackage(p) : undefined), [p])

  if (isPending) return <div aria-busy="true" aria-label="Đang tải gói dịch vụ" className="mx-auto h-[560px] max-w-[980px] animate-pulse rounded-md bg-muted" />
  if (isError || !p || !pkg) {
    return (
      <div className="mx-auto max-w-[980px]">
        <EmptyState
          title="Chưa mở được gói dịch vụ"
          description={error?.message}
          action={
            <div className="flex gap-2">
              <Button onClick={() => refetch()}>Thử lại</Button>
              <Button asChild variant="outline">
                <Link to={paths.admin.catalog}>Về danh sách</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const pending = p.status === 'PENDING'
  const isUpdate = p.reviewKind === 'UPDATE'
  const changes = changesOf(p)

  function openRevisionConfirm() {
    if (!note.trim()) return setFormError('Nhập lý do chỉnh sửa / bổ sung để nhà cung cấp biết cần sửa gì.')
    setFormError('')
    setConfirm('revision')
  }
  /** Sau khi Admin xác nhận trong popup: duyệt hoặc yêu cầu chỉnh sửa, xong về danh sách. */
  function submitReview() {
    const done = { onSuccess: () => navigate(paths.admin.catalog), onError: (e: Error) => (setConfirm(null), setFormError(e.message)) }
    if (confirm === 'approve') review.mutate({ id: p!.id }, done)
    else review.mutate({ id: p!.id, note: note.trim() }, done)
  }

  const actions = pending && (
    <div className="grid gap-3">
      {asking && (
        <label className="grid gap-1.5 rounded-md border border-warn/35 bg-warn-soft px-4 py-3.5">
          <span className="text-[13px] font-medium text-warn">Lý do chỉnh sửa / bổ sung *</span>
          <textarea
            rows={4}
            autoFocus
            maxLength={1000}
            className={cn(controlClass, 'h-auto bg-surface py-2.5 leading-relaxed')}
            placeholder="VD: Mô tả còn sơ sài, vui lòng bổ sung và thêm ảnh thực tế."
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
  )

  return (
    <div className="mx-auto max-w-[980px]">
      <PageTitle
        title="Chi tiết gói dịch vụ"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PackageStatusBadge pkg={{ status: pkg.status }} large />
            {p.reviewKind && <ReviewKindBadge kind={p.reviewKind} />}
          </div>
        }
      />

      {isUpdate && pending && (
        <Notice tone="info" title="Gói đang đăng, nhà cung cấp vừa gửi bản cập nhật.">
          <p>Nội dung bên dưới là bản cập nhật. Khách vẫn thấy phiên bản đang đăng cho tới khi bạn phê duyệt.</p>
          {changes.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {pending && p.lastRevision?.note && (
        <Notice tone="warn" title={`Gói đã gửi lại sau lần yêu cầu chỉnh sửa trước${p.lastRevision.reviewedAt ? ` (${formatDateTime(p.lastRevision.reviewedAt)})` : ''}`}>
          <p>
            <b>Lý do lần trước:</b> {p.lastRevision.note}
          </p>
          <p>Đối chiếu xem nhà cung cấp đã sửa đúng các mục này chưa.</p>
        </Notice>
      )}
      {p.status === 'NEEDS_REVISION' && p.reviewNote && (
        <Notice tone="warn" title={p.published ? 'Đã yêu cầu nhà cung cấp chỉnh sửa / bổ sung bản cập nhật' : 'Đã yêu cầu nhà cung cấp chỉnh sửa / bổ sung'}>
          <p>
            <b>Lý do:</b> {p.reviewNote}
          </p>
          {p.published && <p>Gói vẫn hiển thị phiên bản đang đăng trong lúc nhà cung cấp chỉnh sửa.</p>}
        </Notice>
      )}

      <PackageEditor key={pkg.updatedAt} pkg={pkg} category={pkg.category} vendorName={p.vendor.name} readOnly actions={actions} />

      <AdminConfirm
        open={confirm === 'approve'}
        onOpenChange={(o) => !o && !review.isPending && setConfirm(null)}
        icon={Check}
        confirmIcon={Check}
        title="Phê duyệt gói dịch vụ này?"
        confirmLabel="Phê duyệt"
        pending={review.isPending}
        notice={isUpdate ? 'Khách sẽ thấy nội dung mới ngay và nhà cung cấp nhận được thông báo.' : 'Gói sẽ được hiển thị công khai và nhà cung cấp nhận được thông báo.'}
        onConfirm={submitReview}
      >
        {isUpdate ? (
          <>
            Bản cập nhật của gói <strong className="text-ink">{p.name}</strong> ({p.vendor.name}) sẽ thay cho phiên bản đang đăng.
          </>
        ) : (
          <>
            Gói <strong className="text-ink">{p.name}</strong> của {p.vendor.name} sẽ chuyển sang trạng thái Đã đăng.
          </>
        )}
      </AdminConfirm>

      <AdminConfirm
        open={confirm === 'revision'}
        onOpenChange={(o) => !o && !review.isPending && setConfirm(null)}
        icon={MessageSquareWarning}
        confirmIcon={MessageSquareWarning}
        title="Gửi yêu cầu chỉnh sửa / bổ sung?"
        confirmLabel="Gửi yêu cầu"
        pending={review.isPending}
        notice={
          isUpdate
            ? 'Bản cập nhật chuyển sang Cần chỉnh sửa, gói vẫn hiển thị phiên bản đang đăng. Nhà cung cấp sẽ nhận được thông báo kèm lý do.'
            : 'Gói chuyển sang Cần chỉnh sửa. Nhà cung cấp sẽ nhận được thông báo kèm lý do.'
        }
        onConfirm={submitReview}
      >
        Yêu cầu chỉnh sửa gói <strong className="text-ink">{p.name}</strong> với lý do: “{note.trim()}”.
      </AdminConfirm>
    </div>
  )
}
