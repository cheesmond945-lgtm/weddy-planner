import { EventEmitter } from 'node:events';

/*
 * Kênh sự kiện realtime trong tiến trình. Các hàm dùng chung (postMessage, notify) không có DI nên đẩy sự kiện qua đây;
 * RealtimeGateway nghe và phát tới phòng `user:<id>` của từng người nhận qua Socket.IO.
 * Chỉ báo "có thay đổi" (id hội thoại, id đơn), FE tự tải lại dữ liệu qua REST nên hợp đồng API không đổi.
 * Chạy một tiến trình backend; nhiều tiến trình thì cần adapter Redis cho Socket.IO.
 */

export type RealtimeEventName = 'message' | 'read' | 'notification';

export interface RealtimeEvent {
  /** Users.Id của người nhận */
  users: string[];
  event: RealtimeEventName;
  data: Record<string, unknown>;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

/** Không bao giờ ném lỗi: realtime chỉ là phụ, việc ghi dữ liệu đã xong. */
export function publish(e: RealtimeEvent) {
  try {
    if (e.users.length) bus.emit('event', e);
  } catch {
    /* bỏ qua */
  }
}

export function onPublish(listener: (e: RealtimeEvent) => void) {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}
