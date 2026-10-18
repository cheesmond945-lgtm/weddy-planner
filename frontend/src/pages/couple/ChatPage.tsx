import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { ChatView } from '@/features/chat/components/ChatView'
import { useConversations } from '@/features/chat/hooks'
import { paths } from '@/routes/paths'

/** Trang Tin nhắn (6.1, 6.2). Hội thoại đang mở lưu trên URL ?c=. */
export default function ChatPage() {
  const { data: conversations, isPending, isError, error, refetch } = useConversations({ poll: true })
  const [params, setParams] = useSearchParams()

  if (isPending) return <div className="h-[calc(100dvh-142px)] min-h-[610px] animate-pulse rounded-[26px] bg-muted" aria-busy="true" aria-label="Đang tải" />

  if (isError) {
    return (
      <EmptyState
        title="Không tải được tin nhắn"
        description={error.message}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  if (!conversations.length) {
    return (
      <>
        <PageTitle title="Tin nhắn" />
        <EmptyState
          title="Chưa có cuộc trò chuyện"
          description="Mở một dịch vụ và chọn Nhắn tin với nhà cung cấp để bắt đầu."
          action={
            <Button asChild>
              <Link to={paths.services}>Khám phá dịch vụ</Link>
            </Button>
          }
        />
      </>
    )
  }

  const activeId = params.get('c') ?? conversations[0].id
  return <ChatView conversations={conversations} activeId={activeId} onSelect={(id) => setParams({ c: id }, { replace: true })} />
}
