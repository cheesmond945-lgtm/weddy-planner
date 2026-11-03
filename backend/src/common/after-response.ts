/*
 * Việc phụ chạy SAU khi đã trả response (thông báo cho khách, realtime, nhắc hạn…): không await trong request nên API trả lời nhanh.
 * Lỗi được bắt và ghi log, không bao giờ làm hỏng việc đã lưu hay response đã gửi.
 */
export function runAfter(label: string, fn: () => unknown | Promise<unknown>, log: (message: string) => void = (m) => console.error(m)): void {
  setImmediate(() => {
    Promise.resolve()
      .then(fn)
      .catch((e: unknown) => log(`[sau response] ${label}: ${e instanceof Error ? e.message : String(e)}`));
  });
}
