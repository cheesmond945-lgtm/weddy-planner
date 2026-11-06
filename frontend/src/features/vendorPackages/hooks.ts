import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorPackagesApi } from '@/api/vendorPackages'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { PackageTask, SavePackageRequest, VendorPackage } from '@/types/vendorPackage'
import { useMemo, useState } from 'react'
import { fromServer, isDirty, toRequest, type TaskDraft } from './packageTasks'

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
      if (pkg.status === 'PUBLISHED') {
        return toast(
          submitted
            ? `Đã gửi duyệt bản cập nhật “${pkg.name}”. Khách vẫn thấy phiên bản đang đăng cho tới khi Admin duyệt.`
            : `Đã lưu nháp bản cập nhật cùng ${pkg.pendingUpdate?.photos.length ?? 0} ảnh. Khách vẫn thấy phiên bản đang đăng.`,
        )
      }
      toast(
        submitted
          ? `Đã gửi duyệt ${pkg.id}. Dịch vụ chưa công khai cho tới khi Admin duyệt.`
          : `Đã lưu nháp gói “${pkg.name}”.`,
      )
    },
    onError: (err) => toast(err.message),
  })
}

type PackageAction = 'submit' | 'hide' | 'republish' | 'remove' | 'discardUpdate'

const DONE: Record<PackageAction, (p: Pick<VendorPackage, 'name'>) => string> = {
  submit: (p) => `Đã gửi duyệt “${p.name}”. Gói chưa công khai cho tới khi được duyệt.`,
  hide: (p) => `Đã ẩn “${p.name}” khỏi danh sách và tìm kiếm công khai.`,
  republish: (p) => `Đã khôi phục “${p.name}”. Khách đã thấy lại gói này.`,
  remove: () => 'Đã xóa bản nháp.',
  discardUpdate: (p) => `Đã xóa bản cập nhật nháp. “${p.name}” giữ nguyên phiên bản đang đăng.`,
}

/** Gửi duyệt, ẩn, khôi phục, xóa bản nháp, xóa bản cập nhật nháp. */
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

/** "Tạo với AI": gợi ý đoạn mô tả gói từ tên, tags, giá, sức chứa. */
export function useSuggestPackageDescription() {
  return useMutation({ mutationFn: vendorPackagesApi.suggestDescription, onError: (err) => toast(err.message) })
}

const taskKeys = (userId: string | undefined, id: string) => ['vendor-packages', userId, id, 'tasks'] as const

export interface PackageTasksDraft {
  /** Danh sách đang sửa trên màn (luôn theo mốc) */
  rows: TaskDraft[]
  /** Có thay đổi chưa lưu so với CSDL */
  dirty: boolean
  loading: boolean
  loadError: Error | null
  saving: boolean
  setRows: (update: (rows: TaskDraft[]) => TaskDraft[]) => void
  /** Bỏ thay đổi, về danh sách đã lưu */
  discard: () => void
  /**
   * Lưu xuống CSDL (PUT .../tasks) cho gói `id`; không có thay đổi thì bỏ qua. Trả true khi xong, false khi lỗi (giữ danh sách và trạng thái chưa lưu).
   * afterPackage: vừa lưu gói xong, báo lỗi theo kiểu "Đã lưu gói, công việc chưa lưu được".
   */
  save: (id: string, opts?: { afterPackage?: boolean }) => Promise<boolean>
  /**
   * Thêm / sửa / xóa / đổi thứ tự một việc. Gói đã tạo: lưu thẳng xuống CSDL (không cần Admin duyệt), lỗi thì giữ danh sách đã lưu.
   * Gói mới (chưa có id): chỉ đổi danh sách trên màn, lưu cùng gói.
   */
  apply: (update: (rows: TaskDraft[]) => TaskDraft[]) => Promise<boolean>
  /** Gói đã có id: mỗi thao tác lưu ngay */
  autoSave: boolean
}

/**
 * Danh sách công việc của gói đang sửa. Giữ ở trang (không ở form) để còn nguyên khi form nạp lại hoặc khi gói mới vừa tạo đổi sang trang của nó.
 * `draft` rỗng: theo dữ liệu đã lưu. Mỗi bản nháp gắn với gói của nó (gói mới chưa có id), sang gói khác thì không dùng.
 */
export function usePackageTasksDraft(packageId: string | undefined): PackageTasksDraft {
  const { user } = useAuth()
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: taskKeys(user?.id, packageId ?? ''),
    queryFn: () => vendorPackagesApi.tasks(packageId!),
    enabled: user?.role === 'VENDOR' && !!packageId,
  })
  const saved = useMemo(() => fromServer(query.data ?? []), [query.data])
  const [draft, setDraft] = useState<{ pid: string | undefined; rows: TaskDraft[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const mine = draft && draft.pid === packageId ? draft.rows : null
  const rows = mine ?? saved
  const dirty = mine !== null && isDirty(mine, saved)

  async function save(id: string, opts?: { afterPackage?: boolean }) {
    // Gói mới vừa tạo: bản nháp còn gắn với "chưa có id"
    const current = mine ?? (draft && draft.pid === undefined ? draft.rows : null)
    if (!current || !isDirty(current, id === packageId ? saved : [])) return true
    return persist(id, current, opts)
  }

  async function persist(id: string, current: TaskDraft[], opts?: { afterPackage?: boolean; revertOnError?: boolean }) {
    setSaving(true)
    try {
      const out: PackageTask[] = await vendorPackagesApi.saveTasks(id, toRequest(current))
      qc.setQueryData(taskKeys(user?.id, id), out)
      qc.setQueryData<VendorPackage>(keys.detail(user?.id, id), (p) => p && { ...p, taskCount: out.length })
      qc.setQueryData<VendorPackage[]>(keys.all(user?.id), (list) => list?.map((p) => (p.id === id ? { ...p, taskCount: out.length } : p)))
      setDraft(null)
      toast(opts?.afterPackage ? 'Đã lưu công việc.' : 'Đã lưu công việc của gói.')
      return true
    } catch (e) {
      setDraft(opts?.revertOnError ? null : { pid: id, rows: current })
      toast(opts?.afterPackage ? 'Đã lưu gói, công việc chưa lưu được — thử lại' : `Chưa lưu được công việc: ${(e as Error).message}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    rows,
    dirty,
    loading: !!packageId && query.isPending,
    loadError: query.isError ? query.error : null,
    saving,
    setRows: (update) => setDraft({ pid: packageId, rows: update(rows) }),
    autoSave: !!packageId,
    apply: async (update) => {
      if (saving) return false
      const next = update(rows)
      if (!packageId) {
        setDraft({ pid: undefined, rows: next })
        return true
      }
      if (!isDirty(next, saved)) return true
      return persist(packageId, next, { revertOnError: true })
    },
    discard: () => setDraft(null),
    save,
  }
}
