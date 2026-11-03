import { useNavigate } from 'react-router'
import { toast } from '@/components/ui/toast'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { paths } from '@/routes/paths'
import { useWedding } from './hooks'

/** Mở "Gợi ý cho bạn" của một hạng mục: sang trang Dịch vụ cưới ở trạng thái thu gọn (?category=…&ai=1). */
export function useAiSuggest() {
  const requireCouple = useRequireCouple()
  const navigate = useNavigate()
  const { data: wedding } = useWedding()

  return (categorySlug: string) =>
    requireCouple(() => {
      if (!wedding) {
        toast('Hãy thiết lập thông tin đám cưới trước')
        navigate(paths.plan)
        return
      }
      navigate(`${paths.services}?category=${categorySlug}&ai=1`)
      window.scrollTo(0, 0)
    })
}
