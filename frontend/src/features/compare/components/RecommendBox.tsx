import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { CompareRecommendation } from '@/types/compare'

interface RecommendBoxProps {
  recommendation: CompareRecommendation
  recommendedName: string | null
  hasWedding: boolean
}

const sentence = (reasons: string[]) => {
  const text = reasons.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

/** Hộp đề xuất phía trên bảng so sánh (.recbox trong prototype). */
export function RecommendBox({ recommendation, recommendedName, hasWedding }: RecommendBoxProps) {
  const tie = recommendation.isTie || !recommendedName
  return (
    <div
      role="note"
      className={cn(
        'mb-4 flex items-start gap-3 rounded-xl border px-[18px] py-3.5',
        tie ? 'border-line bg-surface' : 'border-primary bg-accent-soft',
      )}
    >
      <Sparkles className={cn('mt-0.5 size-5 shrink-0', tie ? 'text-muted-foreground' : 'text-gold')} aria-hidden />
      <div>
        {tie ? (
          <>
            <b className="font-semibold">Các lựa chọn khá ngang nhau</b>
            <div className="mt-0.5 text-sm text-muted-foreground">Chưa có phương án nổi bật hơn rõ rệt, hãy xem khác biệt ở bảng bên dưới.</div>
          </>
        ) : (
          <>
            <b className="font-semibold">WebPlan đề xuất {recommendedName}</b>
            <div className="mt-0.5 text-sm text-ink">
              {sentence(recommendation.reasons)}
              {!hasWedding && (
                <>
                  {' '}
                  <Link to={paths.timeline} className="font-medium text-gold underline underline-offset-[3px]">
                    Thiết lập thông tin đám cưới để đề xuất sát hơn
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
