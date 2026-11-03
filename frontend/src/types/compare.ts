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
  /** "40 × 5.800.000đ" (chỉ tiệc); có đơn thì "Theo đơn đã cọc của bạn" / "Theo đơn nhà cung cấp gửi" */
  formula: string | null
  /** Lịch ngày cưới của gói đang xem; null khi kế hoạch chưa có ngày cưới */
  availability: { status: 'FREE' | 'FULL' | 'UNCONFIRMED' | 'MINE'; text: string } | null
  /** Hệ quả nếu chọn gói này: còn bao nhiêu cho các dịch vụ chưa chọn (over: vượt tổng ngân sách) */
  consequence: { over: boolean; text: string; detail: string } | null
  /** Đã cọc NCC này: khóa ô chọn gói ở gói trong đơn */
  locked: boolean
  /** Ghi chú giả định khi kế hoạch chưa có số khách */
  assumption: string | null
  budget: { kind: 'LEFT' | 'EXACT' | 'OVER'; amount: number; text: string } | null
  tables: { count: number | null; byMinimum: boolean; text: string; warning: string | null } | null
  location: { same: boolean; text: string } | null
  capacity: { max: number; fits: boolean; text: string } | null
  rating: { value: number | null; count: number; text: string }
  /** 3–4 ý ngắn của gói */
  includes: string[]
  /** Khóa nút "Thêm vào kế hoạch" khi: đã kín ngày cưới, đã cọc NCC khác cùng hạng mục, gói tiệc không đủ chỗ */
  canAdd: boolean
  blockReason: string | null
  /** LOCKED: đã cọc NCC khác cùng hạng mục (chỉ hiện cảnh báo chung lockNote); FULL: đã kín ngày cưới; CAPACITY: không đủ chỗ */
  blockKind: 'LOCKED' | 'FULL' | 'CAPACITY' | null
  labels: { cheapest: boolean; largestCapacity: boolean; topRated: boolean }
}

export interface CompareResult {
  category: CategoryRef
  /** ServiceDetail theo đúng thứ tự id gửi lên (đầu cột, nút) */
  items: ServiceDetail[]
  /** Mức gợi ý của hạng mục (giới hạn của hàm phân bổ như khi hạng mục chưa chọn); null khi kế hoạch chưa có tổng ngân sách */
  budget: number | null
  guestCount: number | null
  tables: number | null
  comparison: {
    columns: CompareColumn[]
    /** Các câu nêu khác biệt (không khuyên chọn bên nào); rỗng thì ẩn dòng tóm tắt */
    summary: string[]
    /** Một dòng chung khi mọi bên đều cao hơn mức gợi ý (thay cho chữ từng cột) */
    budgetNote: string | null
    /** "Nếu đổi nhà cung cấp" (đã cọc một bên) / "Nếu chọn gói này" */
    consequenceLabel: string
    /** Đã cọc một NCC của hạng mục: một cảnh báo chung ở đầu trang */
    lockNote: string | null
    /** "Nơi tổ chức: Bồ Đề", ghi dưới nhãn dòng Vị trí */
    locationNote: string | null
    /** "Giống nhau: 30 bàn, đủ cho 300 khách" (các dòng số bàn / sức chứa giống nhau ở mọi bên được gộp vào đây) */
    sameNote: string | null
    /** Dòng nào được hiện */
    rows: { availability: boolean; budget: boolean; consequence: boolean; tables: boolean; location: boolean; capacity: boolean }
  }
}
