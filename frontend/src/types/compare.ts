/*
 * Đơn vị so sánh là nhà cung cấp (theo quyết định của nhóm), ở FE đang gọi là "service" như module catalog.
 * Hợp đồng: docs/api/compare.md. Mọi số liệu, nhãn và dòng tóm tắt do BE tính (compare-rules.ts), FE chỉ hiển thị.
 */
import type { CategoryRef, ServiceDetail } from './catalog'

export interface CompareColumn {
  id: string
  name: string
  /** Gói đang so (gói khách chọn ở dropdown, mặc định gói rẻ nhất trong ngân sách) */
  package: { id: string; name: string; price: number } | null
  /** Dropdown chọn gói, xếp theo tổng chi phí tăng dần */
  packages: { id: string; name: string; total: number | null }[]
  /** Tổng chi phí ước tính; null khi chưa tính được (tiệc chưa có số khách, gói không ghi tối thiểu) */
  total: number | null
  /** "40 × 5.800.000đ" (chỉ tiệc) */
  formula: string | null
  /** Ghi chú giả định khi kế hoạch chưa có số khách */
  assumption: string | null
  budget: { kind: 'LEFT' | 'EXACT' | 'OVER'; amount: number; text: string } | null
  tables: { count: number | null; byMinimum: boolean; text: string; warning: string | null } | null
  location: { same: boolean; text: string } | null
  capacity: { max: number; fits: boolean; text: string } | null
  rating: { value: number | null; count: number; text: string }
  /** 3–4 ý ngắn của gói */
  includes: string[]
  /** Gói tiệc không đủ chỗ thì khóa nút "Thêm vào kế hoạch" */
  canAdd: boolean
  blockReason: string | null
  labels: { cheapest: boolean; largestCapacity: boolean; topRated: boolean }
}

export interface CompareResult {
  category: CategoryRef
  /** ServiceDetail theo đúng thứ tự id gửi lên (đầu cột, nút) */
  items: ServiceDetail[]
  /** Ngân sách hạng mục (giới hạn của hàm phân bổ); null khi kế hoạch chưa có tổng ngân sách */
  budget: number | null
  guestCount: number | null
  tables: number | null
  comparison: {
    columns: CompareColumn[]
    /** Các câu nêu khác biệt (không khuyên chọn bên nào); rỗng thì ẩn dòng tóm tắt */
    summary: string[]
    /** Dòng nào được hiện */
    rows: { budget: boolean; tables: boolean; location: boolean; capacity: boolean }
  }
}
