import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorPackagesApi } from '@/api/vendorPackages'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { SavePackageRequest, VendorPackage } from '@/types/vendorPackage'

const keys = {
  all: (userId: string | undefined) => ['vendor-packages', userId] as const,
  detail: (userId: string | undefined, id: string) => ['vendor-packages', userId, id] as const,
}

/** Danh sách gói của NCC đang đăng nhập. */
export function usePackages() {
  const { user } = useAuth()
  return useQuery({ queryKey: keys.all(user?.id), queryFn: vendorPackagesApi.list, enabled: user?.role === 'VENDOR' })
}

export function usePackage(id: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.detail(user?.id, id ?? ''),
    queryFn: () => vendorPackagesApi.get(id!),
    enabled: user?.role === 'VENDOR' && !!id,
  })
}

/**
 * Cập nhật cache sau khi gói đổi: thay bản chi tiết, đưa gói vào danh sách ngay (gói mới lên đầu)
 * để quay lại danh sách là thấy, rồi tải lại danh sách từ BE.
 */
function useSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return (pkg: VendorPackage) => {
    qc.setQueryData(keys.detail(user?.id, pkg.id), pkg)
    qc.setQueryData<VendorPackage[]>(keys.all(user?.id), (list) =>
      list && (list.some((p) => p.id === pkg.id) ? list.map((p) => (p.id === pkg.id ? pkg : p)) : [pkg, ...list]),
    )
    void qc.invalidateQueries({ queryKey: keys.all(user?.id), exact: true })
  }
}

/**
 * Lưu gói (tạo mới khi chưa có id), submit = true thì gửi duyệt ngay sau khi lưu.
 * Lưu được mà gửi duyệt lỗi thì vẫn trả về gói đã lưu (bản nháp) để trang chuyển sang gói đó, tránh tạo trùng.
 */
export function useSavePackage() {
  const sync = useSync()
  return useMutation({
    // Mất mạng thì báo lỗi ngay, không treo "Đang lưu…" chờ có mạng lại
    networkMode: 'always',
    mutationFn: async ({ id, body, submit }: { id?: string; body: SavePackageRequest; submit: boolean }) => {
      const saved = id ? await vendorPackagesApi.update(id, body) : await vendorPackagesApi.create(body)
      if (!submit) return { pkg: saved, submitted: false }
      try {
        return { pkg: await vendorPackagesApi.submit(saved.id), submitted: true }
      } catch (e) {
        toast(`Đã lưu nháp gói “${saved.name}” nhưng chưa gửi duyệt được: ${(e as Error).message}`)
        return { pkg: saved, submitted: false, submitFailed: true }
      }
    },
    onSuccess: ({ pkg, submitted, submitFailed }) => {
      sync(pkg)
      if (submitFailed) return
      toast(
        submitted
          ? `Đã gửi duyệt ${pkg.id}. Dịch vụ chưa công khai cho tới khi Admin duyệt.`
          : `Đã lưu nháp gói “${pkg.name}”.`,
      )
    },
    onError: (err) => toast(err.message),
  })
}

type PackageAction = 'submit' | 'hide' | 'republish' | 'remove'

const DONE: Record<PackageAction, (p: Pick<VendorPackage, 'name'>) => string> = {
  submit: (p) => `Đã gửi duyệt “${p.name}”. Gói chưa công khai cho tới khi được duyệt.`,
  hide: (p) => `Đã ẩn “${p.name}” khỏi danh sách và tìm kiếm công khai.`,
  republish: (p) => `Đã đăng lại “${p.name}” theo phiên bản đã duyệt.`,
  remove: () => 'Đã xóa bản nháp.',
}

/** Gửi duyệt, ẩn, đăng lại, xóa bản nháp. */
export function usePackageAction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const sync = useSync()
  return useMutation({
    mutationFn: async ({ action, pkg }: { action: PackageAction; pkg: VendorPackage }) => {
      if (action === 'remove') {
        await vendorPackagesApi.remove(pkg.id)
        return null
      }
      return vendorPackagesApi[action](pkg.id)
    },
    onSuccess: (result, { action, pkg }) => {
      if (result) sync(result)
      else {
        qc.removeQueries({ queryKey: keys.detail(user?.id, pkg.id) })
        void qc.invalidateQueries({ queryKey: keys.all(user?.id), exact: true })
      }
      toast(DONE[action](pkg))
    },
    onError: (err) => toast(err.message),
  })
}
