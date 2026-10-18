import { PageTitle } from '@/components/PageTitle'
import { toast } from '@/components/ui/toast'
import { useSaveWedding, useWedding } from '@/features/weddings/hooks'
import { TimelineView } from '@/features/weddings/components/TimelineView'
import { WeddingForm } from '@/features/weddings/components/WeddingForm'

/** Trang Lập Timeline: chưa có thông tin đám cưới thì hiện form thiết lập (4.1), có rồi thì hiện timeline (4.2, 4.4). */
export default function TimelinePage() {
  const { data: wedding, isPending } = useWedding()
  const save = useSaveWedding()

  if (isPending) return <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />

  if (!wedding) {
    return (
      <>
        <PageTitle title="Thiết lập thông tin đám cưới" />
        <div className="max-w-[640px] rounded-lg border border-line bg-surface p-[22px]">
          <WeddingForm
            initial={null}
            submitLabel="Tạo timeline khung"
            pending={save.isPending}
            error={save.error?.message}
            onSubmit={(input) =>
              save.mutate(input, { onSuccess: () => toast('Đã tạo timeline khung') })
            }
          />
        </div>
      </>
    )
  }

  return <TimelineView wedding={wedding} />
}
