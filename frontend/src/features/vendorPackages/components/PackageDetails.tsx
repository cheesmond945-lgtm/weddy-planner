import { EyeOff, RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { FormSection } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VendorPackage } from '@/types/vendorPackage'
import { isVenue } from '../constants'
import { usePackageAction } from '../hooks'
import { useListHref } from './PackageHeader'
import { PackagePhotoSet } from './PackagePhotoSet'

function Item({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={cn(full && 'col-span-full')}>
      <dt className="mb-1 text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="m-0 leading-relaxed">{children ?? '—'}</dd>
    </div>
  )
}

/** Gói đã gửi duyệt / đã đăng / đang ẩn: chỉ xem; đã đăng thì ẩn được, đang ẩn thì đăng lại được (như prototype NCC). */
export function PackageDetails({ pkg }: { pkg: VendorPackage }) {
  const action = usePackageAction()
  const listHref = useListHref()
  const [confirmHide, setConfirmHide] = useState(false)

  return (
    <div className="max-w-[980px] min-w-0 rounded-md border border-line bg-surface px-7 pt-[26px] pb-[22px] shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4">
      <FormSection title="Thông tin gói">
        <dl className="m-0 grid grid-cols-3 gap-x-6 gap-y-[18px] max-sm:grid-cols-2">
          <Item label="Tên gói" full>
            <span className="font-semibold">{pkg.name}</span>
          </Item>
          <Item label="Mô tả ngắn" full>
            {pkg.description || null}
          </Item>
          <Item label="Tags" full>
            {pkg.tags.length ? (
              <span className="flex flex-wrap gap-1.5">
                {pkg.tags.map((t) => (
                  <span key={t} className="rounded-pill border border-line-strong bg-surface px-2 text-[11.5px] leading-5">
                    {t}
                  </span>
                ))}
              </span>
            ) : null}
          </Item>
          <Item label="Giá tối thiểu">{pkg.price === null ? null : formatMoney(pkg.price)}</Item>
          <Item label="Giá tối đa">{pkg.maxPrice === null ? null : formatMoney(pkg.maxPrice)}</Item>
          {isVenue(pkg.category) && <Item label="Sức chứa tối đa">{pkg.capacity ? `${pkg.capacity} khách` : null}</Item>}
          <Item label="Ghi chú" full>
            {pkg.note}
          </Item>
        </dl>
      </FormSection>
      <FormSection title="Hình ảnh dịch vụ">
        <PackagePhotoSet photos={pkg.photos} coverPublicId={pkg.coverPublicId} readOnly />
      </FormSection>

      <div className="sticky bottom-0 z-[5] -mx-7 -mb-[22px] flex flex-wrap items-center justify-end gap-2.5 rounded-b-md border-t border-line bg-surface/95 px-7 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-sm max-sm:-mx-4 max-sm:-mb-4 max-sm:px-4 max-sm:[&>*]:flex-1">
        <Button asChild variant="outline" className="h-10 border-line-strong">
          <Link to={listHref}>Quay lại</Link>
        </Button>
        {pkg.status === 'PUBLISHED' && (
          <Button className="h-10" disabled={action.isPending} onClick={() => setConfirmHide(true)}>
            <EyeOff />
            Ẩn dịch vụ
          </Button>
        )}
        {pkg.status === 'HIDDEN' && (
          <Button className="h-10" disabled={action.isPending} onClick={() => action.mutate({ action: 'republish', pkg })}>
            <RotateCcw />
            Đăng lại
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmHide}
        onOpenChange={setConfirmHide}
        title="Ẩn dịch vụ?"
        confirmLabel="Ẩn dịch vụ"
        onConfirm={() => action.mutate({ action: 'hide', pkg })}
      >
        <p>Khách sẽ không còn thấy dịch vụ này. Dữ liệu và ảnh được giữ nguyên, bạn có thể đăng lại phiên bản đã duyệt bất cứ lúc nào.</p>
      </ConfirmDialog>
    </div>
  )
}
