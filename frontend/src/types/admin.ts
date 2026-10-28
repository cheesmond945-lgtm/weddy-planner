/*
 * Kiểu dữ liệu cổng Admin. Hợp đồng: docs/api/admin.md (bản nháp).
 * Admin KHÔNG tạo hồ sơ hay gói: chỉ duyệt, yêu cầu bổ sung/chỉnh sửa, quản lý tài khoản và ghi nhận thanh toán hoa hồng.
 */
import type { Role } from './auth'
import type { CategoryRef } from './catalog'
import type { VendorDocument, VendorPhoto, VendorProfileStatus } from './vendor'

// ---- Tổng quan ----

/** Số liệu kèm mức tăng giảm so với tháng trước (%). */
export interface TrendStat {
  value: number
  changePct: number
}

/** Một dòng chờ duyệt (hồ sơ NCC hoặc gói dịch vụ). */
export interface WaitingItem {
  id: string
  name: string
  /** Hồ sơ: tên lĩnh vực. Gói: tên nhà cung cấp */
  subtitle: string
  category: CategoryRef
  city: string
  /** ISO thời điểm gửi duyệt */
  submittedAt: string
}

export interface AdminDashboard {
  commissionThisMonth: TrendStat
  /** Tổng giá trị đơn trong tháng (GMV) */
  gmv: TrendStat
  newUsers: TrendStat
  activeVendors: TrendStat
  pendingVendors: number
  pendingPackages: number
  pendingConsultations: number
  waitingVendors: WaitingItem[]
  waitingPackages: WaitingItem[]
  /** Hoa hồng 6 tháng gần nhất, cũ trước ("YYYY-MM") */
  commissionByMonth: { period: string; amount: number }[]
  ordersByCategory: { category: CategoryRef; count: number; percent: number }[]
}

/** Một thông báo của Admin (chuông ở header). */
export interface AdminNotification {
  id: string
  /** NewConsultationRequest | VendorSubmitted | VendorUpdated | PackageSubmitted | CommissionReceived | CommissionOverdue | CommissionLockable */
  type: string
  title: string
  content: string
  isRead: boolean
  /** ISO */
  createdAt: string
  /** ConsultationRequest | VendorProfile | ServicePackage */
  refType: string | null
  refId: string | null
  /** Với thông báo yêu cầu tư vấn: trạng thái hiện tại của yêu cầu (null nếu yêu cầu đã bị xóa) */
  consultation?: { isContacted: boolean; qualification: Qualification; categorySlug: string } | null
}

export interface AdminNotificationList {
  /** Tổng số chưa đọc (không chỉ trong danh sách trả về) */
  unread: number
  items: AdminNotification[]
}

/** Số mục cần xử lý, hiện cạnh menu bên trái. */
export interface AdminCounts {
  consultations: number
  vendors: number
  packages: number
}

// ---- Yêu cầu tư vấn ----

export const QUALIFICATIONS = ['UNRATED', 'QUALIFIED', 'UNQUALIFIED'] as const
export type Qualification = (typeof QUALIFICATIONS)[number]

export interface ConsultationRequest {
  id: string
  brandName: string
  category: CategoryRef
  contactName: string
  phone: string
  email: string
  /** ISO thời điểm gửi yêu cầu */
  createdAt: string
  isContacted: boolean
  contactedAt: string | null
  qualification: Qualification
  /** Ghi chú nội bộ của Admin */
  note: string | null
  /** Đã tạo tài khoản NCC từ yêu cầu này */
  vendorAccountCreated: boolean
}

export interface ConsultationStats {
  total: number
  uncontacted: number
  contacted: number
}

export interface ConsultationList {
  stats: ConsultationStats
  /** Các yêu cầu của trang hiện tại */
  items: ConsultationRequest[]
  /** Tổng số yêu cầu khớp bộ lọc (trên mọi trang) */
  total: number
  /** Trang đang trả về */
  page: number
}

export interface ConsultationQuery {
  /** Chỉ lấy đúng một yêu cầu (mở từ thông báo) */
  id?: string
  q?: string
  categorySlug?: string
  /** YES: đã liên hệ, NO: chưa liên hệ */
  contacted?: 'YES' | 'NO'
  qualification?: Qualification
  page?: number
  pageSize?: number
}

/** Body đăng ký tư vấn hợp tác của nhà cung cấp. */
export interface RegisterConsultationBody {
  brandName: string
  contactName: string
  phone: string
  email: string
  categoryId: string
}

export interface UpdateConsultationBody {
  isContacted?: boolean
  qualification?: Qualification
  note?: string | null
}

// ---- Người dùng ----

export type AdminUserStatus = 'ACTIVE' | 'LOCKED'

export interface AdminUser {
  id: string
  /** Mã hiển thị, ví dụ "ND-00000015" */
  code: string
  username: string
  name: string
  email: string
  phone: string | null
  role: Role
  status: AdminUserStatus
  /** ISO */
  createdAt: string
  lastLoginAt: string | null
  /** Chỉ có trong phản hồi tạo tài khoản khi gửi email không được: mật khẩu hệ thống tự sinh, hiện đúng một lần */
  generatedPassword?: string
  /** Chỉ có trong phản hồi tạo tài khoản / đổi email NCC: đã gửi thông tin đăng nhập qua email chưa */
  emailSent?: boolean
  /** Phản hồi sửa NCC: đã đổi email và cấp mật khẩu mới */
  emailChanged?: boolean
}

export interface AdminUserStats {
  total: number
  couples: number
  vendors: number
  locked: number
}

export interface AdminUserList {
  stats: AdminUserStats
  items: AdminUser[]
  total: number
}

export interface AdminUserQuery {
  q?: string
  role?: Role
  status?: AdminUserStatus
  page?: number
  pageSize?: number
}

/** Body tạo / sửa tài khoản. Mật khẩu do hệ thống tự sinh khi tạo, Admin không nhập. */
export interface SaveUserBody {
  username: string
  email: string
  phone: string
  role: Role
  /** Bắt buộc khi role = VENDOR: lĩnh vực cung cấp (Admin gán, NCC không tự đổi) */
  categoryId?: string
  /** Tạo từ yêu cầu tư vấn nào (nếu có) */
  consultationId?: string
  /** Sửa NCC có đổi email: Admin xác nhận đã xác minh danh tính qua SĐT */
  identityVerified?: boolean
}

// ---- Duyệt hồ sơ NCC ----

export interface AdminVendor {
  id: string
  businessName: string
  taxCode: string | null
  representativeName: string | null
  category: CategoryRef
  province: string
  ward: string | null
  address: string | null
  googleMapsUrl: string | null
  openTime: string | null
  closeTime: string | null
  description: string | null
  documents: VendorDocument[]
  photos: VendorPhoto[]
  status: VendorProfileStatus
  /** Hồ sơ chờ duyệt: 'INITIAL' duyệt lần đầu, 'UPDATE' kiểm tra cập nhật của hồ sơ đã duyệt (hậu kiểm). null khi không chờ */
  reviewKind: 'INITIAL' | 'UPDATE' | null
  /** Lý do Admin yêu cầu bổ sung (lần gần nhất) */
  reviewNote: string | null
  /** Chỉ có ở chi tiết hồ sơ đang chờ duyệt mà từng bị yêu cầu chỉnh sửa: lần yêu cầu gần nhất, để Admin đối chiếu NCC đã sửa chưa */
  lastRevision?: { note: string | null; reviewedAt: string | null } | null
  submittedAt: string | null
  owner: { name: string; email: string; phone: string | null }
}

export interface AdminVendorQuery {
  q?: string
  status?: VendorProfileStatus
  categorySlug?: string
  /** 'recent' (mặc định): nộp gần đây nhất trước; 'oldest': nộp trước nhất */
  sort?: 'recent' | 'oldest'
  /** Chỉ lấy hồ sơ nộp trong N ngày gần đây */
  days?: number
  page?: number
  pageSize?: number
}

export interface AdminVendorList {
  items: AdminVendor[]
  /** Số hồ sơ khớp bộ lọc (để phân trang) */
  total: number
  /** Số hồ sơ theo trạng thái trong phạm vi tìm kiếm và lĩnh vực hiện tại, hiện trên các nhãn trạng thái */
  counts: { ALL: number; PENDING: number; NEEDS_REVISION: number; VERIFIED: number; HIDDEN: number }
}

// ---- Duyệt gói dịch vụ ----

export const ADMIN_PACKAGE_STATUSES = ['PENDING', 'NEEDS_REVISION', 'PUBLISHED', 'HIDDEN'] as const
export type AdminPackageStatus = (typeof ADMIN_PACKAGE_STATUSES)[number]

export interface AdminPackage {
  id: string
  name: string
  description: string
  price: number
  capacity: number | null
  /** Trung tâm sự kiện: số mâm tối thiểu để được kèm sảnh */
  minTables?: number | null
  tags: string[]
  /** Ảnh theo thứ tự, ảnh đầu là ảnh bìa */
  photos: string[]
  category: CategoryRef
  vendor: { id: string; name: string; city: string }
  status: AdminPackageStatus
  /** Duyệt lần đầu (gói chưa đăng) hoặc duyệt bản cập nhật của gói đã đăng; null khi không chờ duyệt */
  reviewKind: 'INITIAL' | 'UPDATE' | null
  reviewNote: string | null
  /** Bản đang hiển thị với khách khi gói có bản cập nhật đã gửi (các trường trên là bản cập nhật); null nếu không có */
  published: { name: string; description: string; price: number; capacity: number | null; minTables?: number | null; tags: string[]; photos: string[] } | null
  submittedAt: string | null
  /** Chỉ ở chi tiết: lần gửi trước bị yêu cầu chỉnh sửa (để đối chiếu) */
  lastRevision?: { note: string | null; reviewedAt: string | null } | null
}

export interface AdminPackageQuery {
  q?: string
  status?: AdminPackageStatus
  categorySlug?: string
  /** Chỉ lấy gói nộp trong N ngày gần đây */
  days?: number
  page?: number
  pageSize?: number
}

export interface AdminPackageList {
  items: AdminPackage[]
  /** Số gói khớp bộ lọc (để phân trang) */
  total: number
  /** Số gói theo trạng thái trong phạm vi tìm kiếm, lĩnh vực và thời gian nộp hiện tại, hiện trên các nhãn trạng thái */
  counts: { ALL: number; PENDING: number; NEEDS_REVISION: number; PUBLISHED: number; HIDDEN: number }
}

// ---- Thanh toán (bảng kê hoa hồng) ----

export type AdminStatementStatus = 'UNPAID' | 'PAID'

export interface AdminStatement {
  id: string
  /** Mã bảng kê, ví dụ "DS102026-0001" */
  code: string
  vendor: { id: string; name: string }
  category: CategoryRef
  /** Kỳ "YYYY-MM" */
  period: string
  orderCount: number
  /** Doanh thu: tổng giá trị đơn hoàn thành trong kỳ */
  revenue: number
  commissionAmount: number
  /** Hạn thanh toán "YYYY-MM-DD" */
  dueDate: string
  status: AdminStatementStatus
  isOverdue: boolean
  /** Đã thanh toán sau hạn bao nhiêu ngày; null: chưa trả hoặc trả đúng hạn */
  lateDays: number | null
  /** ISO, khi đã thanh toán */
  paidAt: string | null
  transactionCode: string | null
}

export interface AdminPaymentStats {
  /** Tổng hoa hồng của các bảng kê đang lọc */
  total: number
  paid: number
  unpaid: number
}

export interface AdminStatementList {
  stats: AdminPaymentStats
  items: AdminStatement[]
  total: number
  /** Các kỳ có bảng kê, mới nhất trước */
  periods: string[]
  /** Các năm có bảng kê (cho ô chọn năm), mới nhất trước */
  years: number[]
}

export interface AdminStatementQuery {
  q?: string
  status?: AdminStatementStatus
  /** Năm (YYYY) và tháng (1-12) của kỳ; dùng riêng từng cái hoặc cùng nhau */
  year?: number
  month?: number
  period?: string
  page?: number
  pageSize?: number
}

/** Một đơn được tính hoa hồng trong bảng kê. */
export interface AdminStatementLine {
  id: string
  orderId: string
  orderCode: string
  customerName: string
  /** "YYYY-MM-DD" */
  eventDate: string
  /** ISO, lúc NCC xác nhận thu đủ (đơn hoàn thành) */
  completedAt: string | null
  orderAmount: number
  /** Tỷ lệ hoa hồng (%) lưu cố định lúc tính */
  rate: number
  commissionAmount: number
  /** Có giá trị khi đơn hoàn thành ở tháng khác kỳ này (tính dồn vì bảng kê tháng đó đã thanh toán): "YYYY-MM" */
  originPeriod: string | null
}

/** Chi tiết bảng kê: thêm thông tin nhà cung cấp, kỳ và từng đơn tính hoa hồng. */
export interface AdminStatementDetail extends AdminStatement {
  /** Ngày chốt kỳ "YYYY-MM-DD" (ngày cuối tháng) */
  closingDate: string
  /** ISO */
  createdAt: string
  /** Tỷ lệ hoa hồng bình quân theo doanh thu (%) */
  averageRate: number
  vendorInfo: {
    id: string
    businessName: string
    representativeName: string | null
    taxCode: string | null
    address: string | null
    ownerName: string
    email: string
    phone: string | null
    /** Tài khoản NCC đang bị khóa */
    accountLocked: boolean
  }
  lines: AdminStatementLine[]
}

