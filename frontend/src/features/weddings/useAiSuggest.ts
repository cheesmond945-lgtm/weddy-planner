import { useNavigate } from 'react-router'
import { toast } from '@/components/ui/toast'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { paths } from '@/routes/paths'
import { useWedding } from './hooks'

/** Mở gợi ý AI cho một hạng mục: sang trang Dịch vụ cưới, lọc theo hạng mục, hiện khung gợi ý (aiSuggest trong prototype). */
export function useAiSuggest() {
  const requireCouple = useRequireCouple()
  const navigate = useNavigate()
  const { data: wedding } = useWedding()

  return (categorySlug: string) =>
    requireCouple(() => {
      if (!wedding) {
        toast('Hãy thiết lập thông tin đám cưới trước')
        navigate(paths.timeline)
        return
      }
      navigate(`${paths.services}?category=${categorySlug}&ai=1`)
      window.scrollTo(0, 0)
    })
}
