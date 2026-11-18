/**
 * Tin thẻ gói dịch vụ trong chat. CSDL chỉ cho các loại tin cố định (CHECK messages_type_check: Text, Order, DepositReceipt,
 * FinalInvoice, Image, File, Audio) nên thẻ gói lưu là tin Text, nội dung dạng "pkg:<id gói> <tên gói>"; khi đọc, backend trả
 * type = 'Package' kèm thẻ gói. Không cần sửa CSDL dùng chung.
 * id để vẽ thẻ (ảnh, giá) lúc đọc, tên để còn đọc được khi gói đã bị xóa và cho đoạn trích / tin cuối / trả lời tự động.
 */
const PREFIX = 'pkg:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Số gói tối đa gửi trong một lần (ô chọn "Gửi gói") */
export const MAX_PACKAGES_PER_SEND = 5;

/** Loại tin lưu trong CSDL cho thẻ gói */
export const PACKAGE_STORED_TYPE = 'Text' as const;

export const packageContent = (id: string, name: string) => `${PREFIX}${id} ${name}`;

/** Đọc id và tên gói từ content; content không đúng dạng thẻ gói thì id null, tên là cả content */
export function parsePackageContent(content: string | null): { id: string | null; name: string } {
  const s = content ?? '';
  if (!s.startsWith(PREFIX)) return { id: null, name: s };
  const id = s.slice(PREFIX.length, PREFIX.length + 36);
  return UUID.test(id) && s.charAt(PREFIX.length + 36) === ' ' ? { id, name: s.slice(PREFIX.length + 37).trim() } : { id: null, name: s };
}

/** Tin là thẻ gói: tin Text có nội dung đúng dạng "pkg:<id> <tên>" */
export const isPackageMessage = (type: string | null, content: string | null) => (type === PACKAGE_STORED_TYPE || type === 'Package') && parsePackageContent(content).id !== null;

/** Nội dung đọc được của một tin: thẻ gói thành "Gói <tên>", các tin khác giữ nguyên */
export const readableContent = (type: string | null, content: string | null) => (isPackageMessage(type, content) ? `Gói ${parsePackageContent(content).name}` : (content ?? ''));
