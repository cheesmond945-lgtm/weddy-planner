import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '@/api/client'
import { sharingApi } from '@/api/sharing'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { PLAN_TAB_LABEL } from '@/features/weddings/access'
import { formatDate } from '@/lib/date'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

const RELATION = { BRIDE: 'cô dâu', GROOM: 'chú rể', RELATIVE: 'người thân' } as const
const STATUS_TEXT = { USED: 'Link mời này đã được dùng.', REVOKED: 'Link mời này đã bị thu hồi.', EXPIRED: 'Link mời này đã hết hạn.' } as const

/**
 * Trang nhận lời mời cùng lập kế hoạch (/moi/:token, docs/api/sharing.md mục 2).
 * Chưa đăng nhập: đăng nhập hoặc đăng ký rồi quay lại đây (bỏ qua hộp thiết lập đám cưới) và tự nhận lời mời.
 * Đang có kế hoạch riêng còn trống: hỏi "Bỏ kế hoạch riêng để tham gia?".
 */
export default function InvitePage() {
  const { token = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => sharingApi.getInvite(token), retry: false })
  const [state, setState] = useState<{ kind: 'idle' | 'joining' | 'confirm' | 'error'; message?: string }>({ kind: 'idle' })
  const started = useRef(false)

  async function accept(leaveOwnPlan: boolean) {
    setState({ kind: 'joining' })
    try {
      await sharingApi.acceptInvite(token, leaveOwnPlan)
      await qc.invalidateQueries()
      toast('Bạn đã tham gia kế hoạch')
      navigate(paths.plan, { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OWN_PLAN_EXISTS') setState({ kind: 'confirm', message: e.message })
      else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Không nhận được lời mời.' })
    }
  }

  // Đã đăng nhập bằng tài khoản cặp đôi và lời mời còn hiệu lực: tự nhận
  const canAccept = user?.role === 'COUPLE' && invite.data?.status === 'VALID'
  useEffect(() => {
    if (canAccept && !started.current) {
      started.current = true
      void accept(false)
    }
  })

  if (invite.isPending) return <div className="mx-auto h-[260px] max-w-[560px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải lời mời" />
  if (invite.isError) {
    return <EmptyState title="Link mời không dùng được" description={invite.error.message} action={<Button asChild variant="outline"><Link to={paths.services}>Về trang chủ</Link></Button>} />
  }

  const inv = invite.data
  const from = { from: `/moi/${token}` }
  return (
    <section className="mx-auto flex max-w-[560px] flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-7 text-center">
      <p className="text-sm text-muted-foreground">{inv.inviterName} mời bạn cùng lập kế hoạch đám cưới</p>
      <h1 className="text-[clamp(26px,4vw,36px)] leading-tight">
        {inv.wedding.groomName}
        <span className="px-[0.22em] font-medium text-primary italic">&amp;</span>
        {inv.wedding.brideName}
      </h1>
      <p className="text-muted-foreground">Ngày cưới {formatDate(inv.wedding.date)}</p>
      <p className="text-sm">
        Bạn tham gia với vai trò <b>{inv.displayName || RELATION[inv.relation]}</b>, quyền <b>{inv.role === 'EDITOR' ? 'chỉnh sửa' : 'chỉ xem'}</b>, xem được{' '}
        {inv.tabs.filter((t) => t !== 'timeline').map((t) => PLAN_TAB_LABEL[t].toLowerCase()).join(', ')}.
      </p>

      {inv.status !== 'VALID' ? (
        <p className="font-medium text-warn">{STATUS_TEXT[inv.status]} Hãy xin người mời gửi link mới.</p>
      ) : !user ? (
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button asChild>
            <Link to={paths.login} state={from}>
              Đăng nhập để tham gia
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={paths.register} state={from}>
              Đăng ký tài khoản
            </Link>
          </Button>
        </div>
      ) : user.role !== 'COUPLE' ? (
        <p className="font-medium text-warn">Tài khoản nhà cung cấp hoặc quản trị không nhận được lời mời. Hãy đăng nhập bằng tài khoản cặp đôi.</p>
      ) : state.kind === 'confirm' ? (
        <div className="flex flex-col items-center gap-3 rounded-md bg-warn-soft px-4 py-3.5">
          <p className="text-sm">{state.message} Kế hoạch riêng của bạn (thông tin đám cưới, timeline, dịch vụ đã chọn) sẽ bị xóa.</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button onClick={() => void accept(true)}>Bỏ kế hoạch riêng và tham gia</Button>
            <Button asChild variant="outline">
              <Link to={paths.plan}>Giữ kế hoạch riêng</Link>
            </Button>
          </div>
        </div>
      ) : state.kind === 'error' ? (
        <div className="flex flex-col items-center gap-2.5">
          <p className="font-medium text-warn">{state.message}</p>
          <Button variant="outline" onClick={() => void accept(false)}>
            Thử lại
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground" role="status">
          Đang nhận lời mời…
        </p>
      )}
    </section>
  )
}
