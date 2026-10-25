import type {
  AdminCounts,
  AdminDashboard,
  AdminPackage,
  AdminPackageList,
  AdminPackageQuery,
  AdminStatementDetail,
  AdminStatementList,
  AdminStatementQuery,
  AdminUser,
  AdminUserList,
  AdminUserQuery,
  AdminVendor,
  AdminVendorList,
  AdminVendorQuery,
  AdminNotificationList,
  ConsultationList,
  ConsultationQuery,
  ConsultationRequest,
  SaveUserBody,
  UpdateConsultationBody,
} from '@/types/admin'
import { http } from './client'


/** Cổng Admin. Hợp đồng: docs/api/admin.md. Mọi endpoint chỉ role ADMIN. */
export const adminApi = {
  // Thông báo của Admin đang đăng nhập (chưa có dữ liệu giả: luôn gọi backend)
  listNotifications: (): Promise<AdminNotificationList> => http.get('/admin/notifications', { query: { limit: 20 } }),
  readNotification: (id: string): Promise<null> => http.post(`/admin/notifications/${id}/read`),
  readAllNotifications: (): Promise<null> => http.post('/admin/notifications/read-all'),

  counts: (): Promise<AdminCounts> => http.get('/admin/counts'),
  dashboard: (): Promise<AdminDashboard> => http.get('/admin/dashboard'),

  // Yêu cầu tư vấn
  listConsultations: (query: ConsultationQuery): Promise<ConsultationList> =>
    http.get('/admin/consultation-requests', { query: { ...query } }),
  updateConsultation: (id: string, body: UpdateConsultationBody): Promise<ConsultationRequest> =>
    http.patch(`/admin/consultation-requests/${id}`, body),
  deleteConsultation: (id: string): Promise<null> => http.delete(`/admin/consultation-requests/${id}`),

  // Người dùng
  listUsers: (query: AdminUserQuery): Promise<AdminUserList> => http.get('/admin/users', { query: { ...query } }),
  createUser: (body: SaveUserBody): Promise<AdminUser> => http.post('/admin/users', body),
  updateUser: (id: string, body: SaveUserBody): Promise<AdminUser> => http.patch(`/admin/users/${id}`, body),
  lockUser: (id: string): Promise<AdminUser> => http.post(`/admin/users/${id}/lock`),
  unlockUser: (id: string): Promise<AdminUser> => http.post(`/admin/users/${id}/unlock`),
  deleteUser: (id: string): Promise<null> => http.delete(`/admin/users/${id}`),

  // Duyệt hồ sơ nhà cung cấp
  listVendors: (query: AdminVendorQuery): Promise<AdminVendorList> => http.get('/admin/vendors', { query: { ...query } }),
  getVendor: (id: string): Promise<AdminVendor> => http.get(`/admin/vendors/${id}`),
  approveVendor: (id: string): Promise<AdminVendor> => http.post(`/admin/vendors/${id}/approve`),
  requestVendorRevision: (id: string, note: string): Promise<AdminVendor> =>
    http.post(`/admin/vendors/${id}/request-revision`, { note }),

  // Duyệt gói dịch vụ
  listPackages: (query: AdminPackageQuery): Promise<AdminPackageList> => http.get('/admin/packages', { query: { ...query } }),
  getPackage: (id: string): Promise<AdminPackage> => http.get(`/admin/packages/${id}`),
  approvePackage: (id: string): Promise<AdminPackage> => http.post(`/admin/packages/${id}/approve`),
  requestPackageRevision: (id: string, note: string): Promise<AdminPackage> =>
    http.post(`/admin/packages/${id}/request-revision`, { note }),

  // Thanh toán hoa hồng
  getStatement: (id: string): Promise<AdminStatementDetail> => http.get(`/admin/commissions/${id}`),
  listStatements: (query: AdminStatementQuery): Promise<AdminStatementList> =>
    http.get('/admin/commissions', { query: { ...query } }),
}
