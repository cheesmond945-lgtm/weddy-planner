import { mockVendorPackages } from '@/mocks/vendorPackages'
import { authStore } from '@/store/auth'
import type { SavePackageRequest, VendorPackage } from '@/types/vendorPackage'
import { ApiError, http } from './client'
import { isMock, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 300) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Hợp đồng: docs/api/catalog.md (phần Nhà cung cấp). Ảnh gói upload qua vendorsApi.uploadFile('PACKAGE_PHOTO'). */
export const vendorPackagesApi = {
  list: (): Promise<VendorPackage[]> => (isMock('vendors') ? mock((u) => mockVendorPackages.list(u)) : http.get('/vendors/me/packages')),

  get: (id: string): Promise<VendorPackage> => (isMock('vendors') ? mock((u) => mockVendorPackages.get(u, id)) : http.get(`/vendors/me/packages/${id}`)),

  create: (body: SavePackageRequest): Promise<VendorPackage> =>
    isMock('vendors') ? mock((u) => mockVendorPackages.create(u, body), 450) : http.post('/vendors/me/packages', body),

  update: (id: string, body: SavePackageRequest): Promise<VendorPackage> =>
    isMock('vendors') ? mock((u) => mockVendorPackages.update(u, id, body), 450) : http.patch(`/vendors/me/packages/${id}`, body),

  remove: (id: string): Promise<null> =>
    isMock('vendors') ? mock((u) => (mockVendorPackages.remove(u, id), null)) : http.delete(`/vendors/me/packages/${id}`),

  submit: (id: string): Promise<VendorPackage> =>
    isMock('vendors') ? mock((u) => mockVendorPackages.submit(u, id)) : http.post(`/vendors/me/packages/${id}/submit`),

  hide: (id: string): Promise<VendorPackage> => (isMock('vendors') ? mock((u) => mockVendorPackages.hide(u, id)) : http.post(`/vendors/me/packages/${id}/hide`)),

  republish: (id: string): Promise<VendorPackage> =>
    isMock('vendors') ? mock((u) => mockVendorPackages.republish(u, id)) : http.post(`/vendors/me/packages/${id}/republish`),
}
