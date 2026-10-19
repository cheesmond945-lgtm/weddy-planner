import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from './ConfirmDialog'

/** Hỏi lại khi rời trang (đổi menu, đóng tab) mà form còn thay đổi chưa lưu (UnsavedGuard trong prototype NCC). */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname)
  // Đã bấm "Rời trang": đóng hộp thoại không được reset() làm hủy lần chuyển trang
  const leaving = useRef(false)

  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && !leaving.current) blocker.reset?.()
      }}
      title="Rời trang khi chưa lưu?"
      confirmLabel="Rời trang"
      cancelLabel="Ở lại"
      onConfirm={() => {
        leaving.current = true
        blocker.proceed?.()
      }}
    >
      <p>Các thay đổi trên hồ sơ chưa được lưu sẽ bị mất.</p>
    </ConfirmDialog>
  )
}
