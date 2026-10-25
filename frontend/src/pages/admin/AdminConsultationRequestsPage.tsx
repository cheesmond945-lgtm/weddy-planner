import { PhoneCall, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { ConsultationCard, QUALIFICATION } from '@/features/adminConsultations/components/ConsultationCard'
import { NoteDialog } from '@/features/adminConsultations/components/NoteDialog'
import { RatingDialog } from '@/features/adminConsultations/components/RatingDialog'
import { useConsultations, useDeleteConsultation, useUpdateConsultation } from '@/features/adminConsultations/hooks'
import { AdminConfirm } from '@/features/adminShared/components/AdminConfirm'
import { TableSkeleton } from '@/features/adminShared/components/AdminTable'
import { Pagination } from '@/features/adminShared/components/Pagination'
import { ClearFilters, FilterSelect, SearchBox } from '@/features/adminShared/components/Filters'
import { useDebounced } from '@/features/adminShared/hooks'
import { UserFormDialog } from '@/features/adminUsers/components/UserFormDialog'
import { useCategories } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'
import { QUALIFICATIONS, type ConsultationRequest, type Qualification } from '@/types/admin'

const PAGE_SIZE = 10

/** Yêu cầu tư vấn từ nhà cung cấp: liên hệ, đánh giá, ghi chú và tạo tài khoản NCC cho yêu cầu đạt tiêu chuẩn. */
export default function AdminConsultationRequestsPage() {
  const [params, setParams] = useSearchParams()
  const categorySlug = params.get('linhvuc') ?? ''
  const contacted = (params.get('lh') ?? '') as '' | 'YES' | 'NO'
  const qualification = (params.get('dg') ?? '') as '' | Qualification
  // Mở từ thông báo: chỉ hiện đúng yêu cầu đó, các ô lọc đã đặt theo trạng thái của nó. Đổi bộ lọc thì trở lại danh sách.
  const openId = params.get('mo') ?? ''
  const pageParam = Math.max(0, Number(params.get('trang')) || 0)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())
  const [note, setNote] = useState<ConsultationRequest | null>(null)
  const [contactTarget, setContactTarget] = useState<ConsultationRequest | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConsultationRequest | null>(null)
  const [rating, setRating] = useState<{ item: ConsultationRequest; target: Qualification } | null>(null)
  const [account, setAccount] = useState<ConsultationRequest | null>(null)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    // Đổi bộ lọc thì về trang 1
    if (!('trang' in patch)) next.delete('trang')
    if (!('mo' in patch)) next.delete('mo')
    setParams(next, { replace: true })
  }

  const { data: categories = [] } = useCategories()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useConsultations({
    id: openId || undefined,
    q: q || undefined,
    categorySlug: categorySlug || undefined,
    contacted: contacted || undefined,
    qualification: qualification || undefined,
    page: pageParam || undefined,
    pageSize: PAGE_SIZE,
  })
  const page = pageParam || 1
  const update = useUpdateConsultation()
  const lastPage = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : page
  useEffect(() => {
    if (data && !isPlaceholderData && page > lastPage) set({ trang: lastPage > 1 ? String(lastPage) : null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isPlaceholderData, page, lastPage])
  const del = useDeleteConsultation()
  const filtering = !!(search || categorySlug || contacted || qualification)
  const clear = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <>
      <PageTitle title="Yêu cầu tư vấn" />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3 shadow-portal">
        <SearchBox value={search} onChange={(v) => { setSearch(v); set({}) }} placeholder="Tìm theo thương hiệu, người liên hệ, SĐT, email" className="min-w-[260px]" />
        <FilterSelect label="Lọc theo lĩnh vực" value={categorySlug} onChange={(v) => set({ linhvuc: v })} className="min-w-[170px]">
          <option value="">Tất cả lĩnh vực</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Lọc theo liên hệ" value={contacted} onChange={(v) => set({ lh: v })} className="min-w-[160px]">
          <option value="">Liên hệ</option>
          <option value="NO">Chưa liên hệ</option>
          <option value="YES">Đã liên hệ</option>
        </FilterSelect>
        <FilterSelect label="Lọc theo đánh giá" value={qualification} onChange={(v) => set({ dg: v })} className="min-w-[170px]">
          <option value="">Đánh giá</option>
          {QUALIFICATIONS.map((v) => (
            <option key={v} value={v}>
              {QUALIFICATION[v].label}
            </option>
          ))}
        </FilterSelect>
        <ClearFilters show={filtering} onClick={clear} />
      </div>

      {isPending ? (
        <TableSkeleton label="Đang tải yêu cầu tư vấn" height={300} />
      ) : isError ? (
        <EmptyState title="Chưa tải được yêu cầu" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
      ) : !data.items.length ? (
        <EmptyState
          title="Không có yêu cầu nào phù hợp"
          description={filtering ? 'Thử đổi tiêu chí tìm kiếm hoặc xóa bộ lọc để xem lại danh sách.' : 'Chưa có yêu cầu tư vấn nào.'}
          action={filtering && <Button variant="outline" onClick={clear}>Xóa bộ lọc</Button>}
        />
      ) : (
        <div className={cn('grid gap-5 transition-opacity', isPlaceholderData && 'opacity-60')}>
          {data.items.map((c) => (
            <ConsultationCard
              key={c.id}
              item={c}
              busy={update.isPending && update.variables?.id === c.id}
              onContacted={(checked) => checked && setContactTarget(c)}
              onRate={(target) => setRating({ item: c, target })}
              onDelete={() => setDeleteTarget(c)}
              onNote={() => setNote(c)}
              onCreateAccount={() => setAccount(c)}
            />
          ))}
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} noun="yêu cầu" onPage={(p) => set({ trang: p > 1 ? String(p) : null })} />
        </div>
      )}

      <AdminConfirm
        open={!!contactTarget}
        onOpenChange={(o) => !o && setContactTarget(null)}
        icon={PhoneCall}
        title="Xác nhận đã liên hệ?"
        confirmLabel="Xác nhận"
        pending={update.isPending}
        notice="Hệ thống sẽ ghi lại thời điểm này và không bỏ tích được sau khi xác nhận."
        onConfirm={() => contactTarget && update.mutate({ id: contactTarget.id, body: { isContacted: true } }, { onSuccess: () => setContactTarget(null) })}
      >
        Bạn đã liên hệ với <b>{contactTarget?.brandName}</b> ({contactTarget?.contactName})?
      </AdminConfirm>
      <AdminConfirm
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        icon={Trash2}
        title="Xóa yêu cầu tư vấn?"
        confirmLabel="Xóa yêu cầu"
        danger
        pending={del.isPending}
        notice="Chỉ dùng cho yêu cầu spam hoặc sai thông tin. Sau khi xóa, số điện thoại và email này được gửi lại yêu cầu mới."
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      >
        Xóa yêu cầu của <b>{deleteTarget?.brandName}</b> ({deleteTarget?.phone})? Không hoàn tác được.
      </AdminConfirm>
      {rating && <RatingDialog key={`${rating.item.id}-${rating.target}`} item={rating.item} target={rating.target} onClose={() => setRating(null)} />}
      {note && <NoteDialog key={note.id} item={note} onClose={() => setNote(null)} />}
      {account && (
        <UserFormDialog
          key={account.id}
          preset={{ role: 'VENDOR', username: account.contactName, locked: true, email: account.email, phone: account.phone, categoryId: categories.find((c) => c.slug === account.category.slug)?.id ?? account.category.id, consultationId: account.id }}
          onClose={() => setAccount(null)}
          onSaved={(u) => toast(`Đã tạo tài khoản nhà cung cấp ${u.username} cho ${account.brandName}.`)}
        />
      )}
    </>
  )
}
