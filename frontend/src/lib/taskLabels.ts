/*
 * Chữ dùng chung cho trạng thái và ngày của việc (NCC + khách), một nơi để mọi màn gọi cùng tên:
 *   - chờ khách: phía NCC "Chờ khách"; phía khách "Bạn cần làm";
 *   - ngày của việc: "Dự kiến · dd/mm/yyyy" / "Đã hẹn · dd/mm/yyyy"; nút "Xác nhận ngày" / "Bỏ xác nhận";
 *   - "Đã chốt" chỉ còn dùng cho DỊCH VỤ đã chốt nhà cung cấp (Mốc chốt);
 * Backend dùng đúng các cụm này trong thông báo (task-owner.ts, order-tasks.service.ts, order-reminders.ts).
 */
export const TASK_LABELS = {
  /** Phía NCC: việc đang chờ khách làm (tên cột Bảng việc, nhãn trên thẻ) */
  waitingCustomer: 'Chờ khách',
  /** Phía khách: việc khách cần làm */
  youNeedToDo: 'Bạn cần làm',
  /** Phía khách: việc hai bên làm cùng NCC / việc NCC tự làm */
  withVendor: 'Cùng NCC',
  vendorDoing: 'NCC thực hiện',
  planned: 'Dự kiến',
  appointed: 'Đã hẹn',
  confirmDate: 'Xác nhận ngày',
  unconfirmDate: 'Bỏ xác nhận',
  /** Việc hai bên chưa xác nhận ngày mà sắp tới hạn */
  needsConfirmDate: 'Cần xác nhận ngày',
  /** Dịch vụ đã chốt nhà cung cấp (Mốc chốt), không dùng cho ngày của việc */
  serviceBooked: 'Đã chốt',
} as const

/** "Dự kiến · 25/05/2027" hoặc "Đã hẹn · 25/05/2027". `date` đã định dạng dd/mm/yyyy. */
export const dateLabel = (confirmed: boolean, date: string) => `${confirmed ? TASK_LABELS.appointed : TASK_LABELS.planned} · ${date}`
