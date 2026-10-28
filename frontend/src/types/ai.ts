/** Số lượt "Tạo với AI" của NCC trong ngày (dùng chung cho hồ sơ và gói). */
export interface AiQuota {
  limit: number
  remaining: number
  /** Thời điểm bộ đếm về 0 (0 giờ ngày mai, giờ Việt Nam) */
  resetsAt: string
}

/** Kết quả một lần AI viết: aiUsed false là đoạn mẫu dự phòng (không tốn lượt). */
export interface AiSuggestion extends AiQuota {
  description: string
  aiUsed: boolean
}
