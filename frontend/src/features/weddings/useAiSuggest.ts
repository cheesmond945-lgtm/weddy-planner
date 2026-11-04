import { useNavigate } from 'react-router'
import { toast } from '@/components/ui/toast'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { paths } from '@/routes/paths'
import { useWedding } from './hooks'
import { openSuggestions } from './suggestDialog'

/** Mở popup "Gợi ý {dịch vụ}" của một hạng mục (SuggestionsDialog) ngay tại trang đang xem. */
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
      openSuggestions(categorySlug)
    })
}
