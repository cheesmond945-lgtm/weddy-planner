import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ProfileStatusBadge } from '@/features/vendors/components/ProfileStatus'
import { paths } from '@/routes/paths'
import type { VendorProfile } from '@/types/vendor'

/** "Công ty TNHH Mây Palace" -> "MP", "Hộ kinh doanh Studio Mây" -> "SM": bỏ loại hình doanh nghiệp, lấy chữ đầu và chữ cuối. */
function initialsOf(name: string) {
  const words = name
    .replace(/^(công ty( tnhh| cổ phần| cp)?( một thành viên| mtv)?|hộ kinh doanh|hkd)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return picked.map((w) => w[0]).join('').toUpperCase()
}

/** Thẻ tóm tắt hồ sơ NCC ở cột phải (profile-summary trong prototype NCC). */
export function ProfileCard({ profile, fallbackName }: { profile: VendorProfile; fallbackName: string }) {
  const name = profile.businessName ?? fallbackName
  const field = profile.verifiedCategory ?? profile.category
  return (
    <section className="rounded-md border border-line bg-surface px-5 py-5 shadow-portal">
      <div className="mb-3 flex items-end gap-3">
        <span aria-hidden className="grid size-[52px] flex-none place-items-center rounded-full border border-line-strong bg-(image:--logo-bg) font-serif text-[22px] font-semibold text-gold-ink italic">
          {initialsOf(name)}
        </span>
        <div className="min-w-0">
          <strong className="block font-serif text-[21px] leading-tight font-semibold">{name}</strong>
          <p className="text-[12.5px] text-muted-foreground">{field?.name ?? 'Chưa chọn lĩnh vực'}</p>
        </div>
      </div>
      <ProfileStatusBadge status={profile.status} />
      <p className="mt-3 mb-4 text-[13px] text-muted-foreground">
        {profile.status === 'VERIFIED'
          ? `Bạn được gửi duyệt gói thuộc lĩnh vực ${profile.verifiedCategory?.name ?? field?.name ?? ''}.`
          : profile.status === 'PENDING'
            ? 'Hồ sơ đang chờ WebPlan xét duyệt, bạn vẫn tạo được gói nháp.'
            : 'Hồ sơ chưa được xác minh, bạn vẫn tạo được gói nháp. Gửi duyệt gói mở sau khi hồ sơ được xác minh.'}
      </p>
      <Button asChild variant="outline" className="w-full border-line-strong">
        <Link to={paths.vendor.profile}>Xem hồ sơ</Link>
      </Button>
    </section>
  )
}
