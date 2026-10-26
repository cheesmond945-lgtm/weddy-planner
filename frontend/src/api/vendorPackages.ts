import type { SavePackageRequest, VendorPackage } from '@/types/vendorPackage'
import { http } from './client'

/** Hợp đồng: docs/api/catalog.md (phần Nhà cung cấp). Ảnh gói upload qua vendorsApi.uploadFile('PACKAGE_PHOTO'). */
export const vendorPackagesApi = {
  list: (): Promise<VendorPackage[]> => (http.get('/vendors/me/packages')),

  /** Gợi ý đoạn mô tả (nút "Tạo với AI") */
  suggestDescription: (body: { name: string | null; tags: string[]; price: number | null; capacity: number | null }): Promise<{ description: string }> =>
    http.post('/vendors/me/packages/suggest-description', body),

  get: (id: string): Promise<VendorPackage> => (http.get(`/vendors/me/packages/${id}`)),

  create: (body: SavePackageRequest): Promise<VendorPackage> =>
    http.post('/vendors/me/packages', body),

  update: (id: string, body: SavePackageRequest): Promise<VendorPackage> =>
    http.patch(`/vendors/me/packages/${id}`, body),

  remove: (id: string): Promise<null> =>
    http.delete(`/vendors/me/packages/${id}`),

  /** Xóa bản cập nhật nháp của gói đã đăng (gói giữ nguyên bản đang đăng) */
  discardUpdate: (id: string): Promise<VendorPackage> =>
    http.delete(`/vendors/me/packages/${id}/update`),

  submit: (id: string): Promise<VendorPackage> =>
    http.post(`/vendors/me/packages/${id}/submit`),

  hide: (id: string): Promise<VendorPackage> => (http.post(`/vendors/me/packages/${id}/hide`)),

  republish: (id: string): Promise<VendorPackage> =>
    http.post(`/vendors/me/packages/${id}/republish`),
}
