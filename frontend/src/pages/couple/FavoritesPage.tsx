import { PageTitle } from '@/components/PageTitle'
import { CompareTray } from '@/features/compare/components/CompareTray'
import { FavoriteGroups } from '@/features/favorites/components/FavoriteGroups'

/** Trang Dịch vụ yêu thích (3.2, 3.3). */
export default function FavoritesPage() {
  return (
    <>
      <PageTitle title="Dịch vụ yêu thích" description="Bấm So sánh trên thẻ để chọn 2 đến 3 dịch vụ cùng hạng mục." />
      <FavoriteGroups />
      <CompareTray />
    </>
  )
}
