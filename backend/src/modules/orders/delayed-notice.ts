/*
 * Thông báo gửi TRỄ, hủy được. NCC đổi ngày một việc thì khách chỉ được báo sau SCHEDULE_NOTICE_DELAY_MS; trong lúc chờ mà NCC bấm "Hoàn tác"
 * (hoặc đổi tiếp) thì thông báo cũ bị hủy, khách không nhận thông báo thừa. Chỉ nằm trong bộ nhớ tiến trình: khởi động lại giữa chừng thì thông báo
 * đang chờ mất (chấp nhận được: thông báo chỉ là phụ, dữ liệu việc đã đúng).
 */

/** NCC có 5 giây để hoàn tác (giao diện); thêm 1 giây đệm cho độ trễ mạng của lời gọi hoàn tác. */
export const SCHEDULE_UNDO_MS = 5000;
export const SCHEDULE_NOTICE_DELAY_MS = SCHEDULE_UNDO_MS + 1000;

export class DelayedNotices {
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly delayMs: number;

  constructor(delayMs: number = SCHEDULE_NOTICE_DELAY_MS) {
    this.delayMs = delayMs;
  }

  /** Hẹn gửi `send` sau `delayMs`. Cùng `key` đang chờ thì thông báo cũ bị thay (chỉ gửi bản cuối). Lỗi khi gửi chuyển cho `onError`. */
  schedule(key: string, send: () => Promise<unknown> | unknown, onError?: (e: unknown) => void) {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.pending.delete(key);
      Promise.resolve()
        .then(send)
        .catch((e) => onError?.(e));
    }, this.delayMs);
    // Không giữ tiến trình sống chỉ vì một thông báo đang chờ
    timer.unref?.();
    this.pending.set(key, timer);
  }

  /** Hủy thông báo đang chờ của `key`. true nếu có thông báo đang chờ để hủy. */
  cancel(key: string): boolean {
    const t = this.pending.get(key);
    if (!t) return false;
    clearTimeout(t);
    this.pending.delete(key);
    return true;
  }

  get size() {
    return this.pending.size;
  }
}
