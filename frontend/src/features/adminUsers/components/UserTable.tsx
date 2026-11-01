import { Lock, Pencil, Trash2, Unlock } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { DataTable, td, th } from '@/features/adminShared/components/AdminTable'
import { formatDateTime } from '@/features/adminShared/format'
import { RowMenu, type RowMenuItem } from '@/features/vendorPackages/components/RowMenu'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/types/admin'
import { ROLE_LABEL, USER_STATUS } from '../constants'

/** Giờ phút trên một dòng, ngày tháng năm dòng dưới. */
function Stamp({ iso }: { iso: string }) {
  const [time, day] = formatDateTime(iso).split(' ')
  return (
    <>
      <span className="block">{time}</span>
      <span className="block">{day}</span>
    </>
  )
}

export type UserAction = 'edit' | 'lock' | 'unlock' | 'delete'

interface UserTableProps {
  users: AdminUser[]
  /** Số thứ tự của dòng đầu trang */
  startIndex: number
  onAction: (user: AdminUser, action: UserAction) => void
}

/** Bảng danh sách người dùng. Tài khoản quản trị viên chỉ sửa được, không khóa hay xóa. */
export function UserTable({ users, startIndex, onAction }: UserTableProps) {
  return (
    <DataTable className="min-w-max">
      <thead>
        <tr>
          <th className={th}>STT</th>
          <th className={th}>Mã người dùng</th>
          <th className={th}>Tên người dùng</th>
          <th className={th}>Số điện thoại</th>
          <th className={th}>Email</th>
          <th className={th}>Vai trò</th>
          <th className={th}>Ngày tạo</th>
          <th className={th}>Thời gian truy cập</th>
          <th className={th}>Trạng thái</th>
          <th className={th}>
            <span className="sr-only">Thao tác</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((u, i) => {
          const edit: RowMenuItem = { label: 'Sửa thông tin', icon: Pencil, onClick: () => onAction(u, 'edit') }
          const lock: RowMenuItem =
            u.status === 'LOCKED' ? { label: 'Mở khóa tài khoản', icon: Unlock, onClick: () => onAction(u, 'unlock') } : { label: 'Khóa tài khoản', icon: Lock, onClick: () => onAction(u, 'lock') }
          // Khách hàng tự đăng ký, tự quản lý thông tin: Admin chỉ khóa / mở khóa, không sửa, không xóa
          const items: RowMenuItem[] =
            u.role === 'ADMIN'
              ? [edit]
              : u.role === 'COUPLE'
                ? [lock]
                : [edit, lock, 'separator', { label: 'Xóa tài khoản', icon: Trash2, danger: true, onClick: () => onAction(u, 'delete') }]
          const st = USER_STATUS[u.status]
          return (
            <tr key={u.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-surface-2">
              <td className={cn(td, 'text-muted-foreground tabular-nums')}>{startIndex + i + 1}</td>
              <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums')}>{u.code}</td>
              <td className={cn(td, 'whitespace-nowrap')}>
                <span className="block font-medium">{u.name}</span>
                <span className="text-[12px] text-muted-foreground">@{u.username}</span>
              </td>
              <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{u.phone ?? '—'}</td>
              <td className={cn(td, 'whitespace-nowrap')}>{u.email}</td>
              <td className={cn(td, 'whitespace-nowrap')}>{ROLE_LABEL[u.role]}</td>
              <td className={cn(td, 'text-[13px] text-muted-foreground tabular-nums')}>
                <Stamp iso={u.createdAt} />
              </td>
              <td className={cn(td, 'text-[13px] text-muted-foreground tabular-nums')}>{u.lastLoginAt ? <Stamp iso={u.lastLoginAt} /> : 'Chưa đăng nhập'}</td>
              <td className={td}>
                <Badge tone={st.tone}>{st.label}</Badge>
              </td>
              <td className={cn(td, 'text-right')}>
                <RowMenu label={u.username} items={items} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
