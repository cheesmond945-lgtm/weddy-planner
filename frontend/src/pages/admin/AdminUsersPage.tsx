import { Lock, Plus, Trash2, Unlock } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { AdminConfirm } from '@/features/adminShared/components/AdminConfirm'
import { TableCard, TableSkeleton } from '@/features/adminShared/components/AdminTable'
import { ClearFilters, FilterBar, FilterSelect, SearchBox } from '@/features/adminShared/components/Filters'
import { Pagination } from '@/features/adminShared/components/Pagination'
import { useDebounced } from '@/features/adminShared/hooks'
import { PAGE_SIZE, ROLE_LABEL } from '@/features/adminUsers/constants'
import { UserFormDialog } from '@/features/adminUsers/components/UserFormDialog'
import { UserTable, type UserAction } from '@/features/adminUsers/components/UserTable'
import { useAdminUsers, useDeleteUser, useLockUser } from '@/features/adminUsers/hooks'
import type { Role } from '@/types/auth'
import type { AdminUser, AdminUserStatus } from '@/types/admin'

type Dialog = { type: 'form'; user?: AdminUser } | { type: UserAction; user: AdminUser } | null

/** Quản lý người dùng: danh sách, tìm kiếm, lọc, thêm / sửa, khóa / mở khóa, xóa tài khoản. */
export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams()
  const role = (params.get('vaitro') ?? '') as Role | ''
  const status = (params.get('tt') ?? '') as AdminUserStatus | ''
  const page = Math.max(1, Number(params.get('trang')) || 1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())
  const [dialog, setDialog] = useState<Dialog>(null)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('trang' in patch)) next.delete('trang')
    setParams(next, { replace: true })
  }

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminUsers({ q: q || undefined, role: role || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
  const lock = useLockUser()
  const del = useDeleteUser()
  const filtering = !!(search || role || status)
  const clear = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  // Tài khoản đang được khóa / mở khóa / xóa (chỉ để hiện tên trong hộp xác nhận)
  const target = dialog && dialog.type !== 'form' ? dialog.user : null
  const onAction = (user: AdminUser, action: UserAction) => setDialog(action === 'edit' ? { type: 'form', user } : { type: action, user })

  return (
    <>
      <PageTitle
        title="Tài khoản người dùng"
        actions={
          <Button onClick={() => setDialog({ type: 'form' })}>
            <Plus />
            Thêm mới tài khoản
          </Button>
        }
      />

      <TableCard>
        <FilterBar>
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm kiếm theo tên, mã, email..." />
          <FilterSelect label="Lọc theo vai trò" value={role} onChange={(v) => set({ vaitro: v })}>
            <option value="">Tất cả vai trò</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Lọc theo trạng thái" value={status} onChange={(v) => set({ tt: v })}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="LOCKED">Ngừng hoạt động</option>
          </FilterSelect>
          <ClearFilters show={filtering} onClick={clear} />
        </FilterBar>

        {isPending ? (
          <TableSkeleton label="Đang tải người dùng" />
        ) : isError ? (
          <div className="p-5">
            <EmptyState title="Chưa tải được danh sách" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
          </div>
        ) : !data.items.length ? (
          <div className="p-5">
            <EmptyState
              title="Không có người dùng nào được tìm thấy"
              description="Không tìm thấy kết quả nào phù hợp với bộ lọc hiện tại của bạn. Vui lòng thử thay đổi tiêu chí tìm kiếm hoặc xóa bộ lọc để xem lại danh sách."
            />
          </div>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <UserTable users={data.items} startIndex={(page - 1) * PAGE_SIZE} onAction={onAction} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} noun="người dùng" onPage={(p) => set({ trang: p > 1 ? String(p) : null })} />
          </div>
        )}
      </TableCard>

      {dialog?.type === 'form' && <UserFormDialog key={dialog.user?.id ?? 'new'} user={dialog.user} onClose={() => setDialog(null)} />}

      <AdminConfirm
        open={dialog?.type === 'lock'}
        onOpenChange={(o) => !o && setDialog(null)}
        icon={Lock}
        confirmIcon={Lock}
        title="Khóa tài khoản người dùng?"
        confirmLabel="Khóa tài khoản"
        pending={lock.isPending}
        notice="Các đơn hàng đang xử lý vẫn được giữ nguyên. Người dùng sẽ nhận được email thông báo."
        onConfirm={() => dialog?.type === 'lock' && lock.mutate({ id: dialog.user.id, lock: true }, { onSuccess: () => setDialog(null) })}
      >
        Người dùng <strong className="text-ink">{target?.name}</strong> ({target?.code}) sẽ không thể đăng nhập và sử dụng nền tảng cho đến khi được mở khóa.
      </AdminConfirm>

      <AdminConfirm
        open={dialog?.type === 'unlock'}
        onOpenChange={(o) => !o && setDialog(null)}
        icon={Unlock}
        confirmIcon={Unlock}
        title="Mở khóa tài khoản người dùng?"
        confirmLabel="Mở khóa tài khoản"
        pending={lock.isPending}
        onConfirm={() => dialog?.type === 'unlock' && lock.mutate({ id: dialog.user.id, lock: false }, { onSuccess: () => setDialog(null) })}
      >
        Mở khóa tài khoản cho người dùng <strong className="text-ink">{target?.name}</strong> ({target?.code}) đăng nhập và tiếp tục sử dụng nền tảng.
      </AdminConfirm>

      <AdminConfirm
        open={dialog?.type === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        icon={Trash2}
        confirmIcon={Trash2}
        danger
        title="Xóa tài khoản người dùng?"
        confirmLabel="Xóa tài khoản"
        pending={del.isPending}
        onConfirm={() => dialog?.type === 'delete' && del.mutate(dialog.user.id, { onSuccess: () => setDialog(null) })}
      >
        Bạn sắp xóa vĩnh viễn tài khoản của <strong className="text-ink">{target?.name}</strong> ({target?.code}). Hành động này không thể hoàn tác và toàn bộ dữ liệu liên quan sẽ bị xóa.
      </AdminConfirm>
    </>
  )
}
