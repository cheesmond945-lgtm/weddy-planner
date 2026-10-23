import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { ProfileStatusBadge, ProfileStatusNotice } from '@/features/vendors/components/ProfileStatus'
import { VendorProfileForm } from '@/features/vendors/components/VendorProfileForm'
import { useVendorProfile } from '@/features/vendors/hooks'

/** Hồ sơ nhà cung cấp: thông tin doanh nghiệp, ảnh cơ sở, giấy tờ và gửi xác minh. */
export default function VendorProfilePage() {
  const { data: profile, isPending, isError, error, refetch } = useVendorProfile()

  return (
    <>
      <PageTitle
        title="Hồ sơ nhà cung cấp"
        description={`Thông tin doanh nghiệp, ảnh cơ sở và giấy tờ xác minh${profile?.businessName ? ` của ${profile.businessName}` : ''}.`}
        actions={profile && <ProfileStatusBadge status={profile.status} />}
      />
      {isPending && <div aria-busy="true" aria-label="Đang tải hồ sơ" className="h-[560px] max-w-[980px] animate-pulse rounded-md bg-muted" />}
      {isError && (
        <EmptyState
          title="Chưa tải được hồ sơ"
          description={error.message}
          action={<Button onClick={() => refetch()}>Thử lại</Button>}
          className="max-w-[980px]"
        />
      )}
      {profile && (
        <>
          <ProfileStatusNotice profile={profile} />
          <VendorProfileForm key={profile.updatedAt} profile={profile} />
        </>
      )}
    </>
  )
}
