import { Eye, EyeOff, ImageIcon, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { toast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { formatDate, toISODate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { canSubmitPackage, coverOf, isVenue, PACKAGE_STATUS } from '../constants'
import { usePackageAction } from '../hooks'
import { toFormValues, validatePackage } from '../packageForm'
import { RowMenu, type RowMenuItem } from './RowMenu'

export function PackageStatusBadge({ pkg }: { pkg: Pick<VendorPackage, 'status'> }) {
  const { label, tone } = PACKAGE_STATUS[pkg.status]
  return (
    <Badge tone={tone}>
      <i aria-hidden className="size-1.5 rounded-full bg-current opacity-75" />
      {label}
    </Badge>
  )
}

export const formatUpdated = (iso: string) => formatDate(toISODate(new Date(iso)))

/** Đi tới trang chi tiết gói, nhớ bộ lọc của danh sách để nút quay lại giữ nguyên. */
export function useOpenPackage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (pkg: Pick<VendorPackage, 'id'>, check?: boolean) =>
    navigate(paths.vendor.package(pkg.id) + (check ? '?check=1' : ''), { state: { listSearch: search } })
}

interface PackageTableProps {
  packages: VendorPackage[]
  profile: VendorProfile | undefined
}

/** Bảng gói dịch vụ (svc-table trong prototype NCC). Bấm dòng để xem chi tiết. */
export function PackageTable({ packages, profile }: PackageTableProps) {
  const open = useOpenPackage()
  const action = usePackageAction()
  const [confirm, setConfirm] = useState<{ type: 'remove' | 'hide'; pkg: VendorPackage } | null>(null)

  // Gửi duyệt từ danh sách: thiếu thông tin thì mở trang chi tiết và hiện lỗi; chưa đủ quyền thì báo
  function submit(pkg: VendorPackage) {
    const errors = validatePackage(toFormValues(pkg), { mode: 'submit', venue: isVenue(pkg.category), canSubmit: canSubmitPackage(profile, pkg.category) })
    if (errors.permission) return toast(errors.permission)
    if (Object.keys(errors).length) return open(pkg, true)
    action.mutate({ action: 'submit', pkg })
  }

  function menu(pkg: VendorPackage): RowMenuItem[] {
    const view: RowMenuItem = { label: 'Xem chi tiết', icon: Eye, onClick: () => open(pkg) }
    switch (pkg.status) {
      case 'DRAFT':
        return [
          view,
          { label: 'Chỉnh sửa', icon: Pencil, onClick: () => open(pkg) },
          { label: 'Gửi duyệt', icon: Send, onClick: () => submit(pkg) },
          'separator',
          { label: 'Xóa', icon: Trash2, danger: true, onClick: () => setConfirm({ type: 'remove', pkg }) },
        ]
      case 'PUBLISHED':
        return [view, { label: 'Ẩn dịch vụ', icon: EyeOff, onClick: () => setConfirm({ type: 'hide', pkg }) }]
      case 'HIDDEN':
        return [view, { label: 'Đăng lại', icon: RotateCcw, onClick: () => action.mutate({ action: 'republish', pkg }) }]
      default:
        return [view]
    }
  }

  const th = 'border-y border-line bg-surface-2 px-4 py-[11px] text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'border-b border-line px-4 py-[15px] align-middle'

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead>
            <tr>
              <th className={th}>Tên gói</th>
              <th className={`${th} text-right`}>Giá tối thiểu</th>
              <th className={`${th} text-right`}>Giá tối đa</th>
              <th className={th}>Tags</th>
              <th className={th}>Trạng thái</th>
              <th className={th}>Ngày cập nhật</th>
              <th className={`${th} text-right`}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => {
              const cover = coverOf(pkg)
              return (
                <tr key={pkg.id} onClick={() => open(pkg)} className="cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2">
                  <td className={td}>
                    <div className="flex min-w-[220px] items-center gap-3">
                      {cover ? (
                        <img src={cover.url} alt="" className="size-[52px] flex-none rounded-sm object-cover" />
                      ) : (
                        <div className="grid size-[52px] flex-none place-items-center rounded-sm border border-dashed border-line-strong bg-surface-2 text-muted-foreground">
                          <ImageIcon className="size-[18px]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            open(pkg)
                          }}
                          className="text-left font-semibold hover:text-gold-ink"
                        >
                          {pkg.name}
                        </button>
                        <p className="text-[12.5px] text-muted-foreground">
                          {pkg.id} · {pkg.photos.length} ảnh
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{pkg.price === null ? '—' : formatMoney(pkg.price)}</td>
                  <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{pkg.maxPrice === null ? '—' : formatMoney(pkg.maxPrice)}</td>
                  <td className={`${td} w-[230px]`}>
                    <div className="flex max-w-[230px] items-center gap-1 overflow-hidden">
                      {pkg.tags.slice(0, 2).map((t) => (
                        <span key={t} title={t} className="inline-block max-w-[104px] min-w-0 truncate rounded-pill border border-line-strong bg-surface px-2 text-[11.5px] leading-5">
                          {t}
                        </span>
                      ))}
                      {pkg.tags.length > 2 && (
                        <span
                          title={pkg.tags.slice(2).join(', ')}
                          aria-label={`Thêm ${pkg.tags.length - 2} tag: ${pkg.tags.slice(2).join(', ')}`}
                          className="inline-grid h-[22px] min-w-7 flex-none place-items-center rounded-pill border border-line bg-surface-2 px-1.5 text-[11.5px] text-muted-foreground"
                        >
                          +{pkg.tags.length - 2}
                        </span>
                      )}
                      {!pkg.tags.length && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className={td}>
                    <PackageStatusBadge pkg={pkg} />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatUpdated(pkg.updatedAt)}</td>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <RowMenu label={pkg.name} items={menu(pkg)} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm?.type === 'remove'}
        onOpenChange={(o) => !o && setConfirm(null)}
        danger
        title="Xóa bản nháp?"
        confirmLabel="Xóa gói"
        onConfirm={() => confirm && action.mutate({ action: 'remove', pkg: confirm.pkg })}
      >
        <p>Gói “{confirm?.pkg.name}” và toàn bộ ảnh của nó sẽ bị xóa. Không thể hoàn tác.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.type === 'hide'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Ẩn dịch vụ?"
        confirmLabel="Ẩn dịch vụ"
        onConfirm={() => confirm && action.mutate({ action: 'hide', pkg: confirm.pkg })}
      >
        <p>Khách sẽ không còn thấy gói này. Bạn có thể đăng lại phiên bản đã duyệt bất cứ lúc nào.</p>
      </ConfirmDialog>
    </>
  )
}
