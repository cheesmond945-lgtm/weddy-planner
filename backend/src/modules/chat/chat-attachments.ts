/*
 * Tệp đính kèm trong chat (ảnh, tệp, ghi âm) như Messenger. Hàm thuần, không DB / Nest; test: backend/test/chat-attachments.test.ts.
 * Danh sách kiểu tệp khớp allowed_mime_types của bucket chat-files (migration chat_attachments).
 */

/** Tối đa 25MB mỗi tệp (bằng file_size_limit của bucket) */
export const MAX_ATTACHMENT_BYTES = 25 * 1048576;
/** Ghi âm tối đa 5 phút */
export const MAX_AUDIO_SECONDS = 300;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const ALLOWED = new Set([...Object.values(MIME_BY_EXT), 'video/webm']);

/** Tên khác mà trình duyệt hay gửi cho cùng kiểu tệp */
const ALIASES: Record<string, string> = {
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'application/x-zip-compressed': 'application/zip',
  'image/jpg': 'image/jpeg',
};

/**
 * Kiểu tệp chuẩn hoá: bỏ tham số (vd "audio/webm;codecs=opus"), đổi tên khác về tên chuẩn; trình duyệt không gửi kiểu (hoặc octet-stream)
 * thì đoán theo đuôi tệp. Trả null nếu không thuộc danh sách cho phép.
 */
export function normalizeMime(mime: string | undefined, fileName: string): string | null {
  let m = (mime ?? '').split(';')[0].trim().toLowerCase();
  m = ALIASES[m] ?? m;
  if (!m || m === 'application/octet-stream') m = MIME_BY_EXT[fileName.split('.').pop()?.toLowerCase() ?? ''] ?? '';
  return ALLOWED.has(m) ? m : null;
}

export type AttachmentKind = 'Image' | 'Audio' | 'File';

/** Loại tin theo kiểu tệp: ảnh, ghi âm (audio), còn lại (gồm video, tài liệu) là tệp */
export const kindOfMime = (mime: string): AttachmentKind => (mime.startsWith('image/') ? 'Image' : mime.startsWith('audio/') ? 'Audio' : 'File');

/** Nội dung chữ của tin đính kèm: hiện ở tin cuối trong danh sách hội thoại, thông báo, đoạn trích khi trả lời */
export function attachmentLabel(kind: AttachmentKind, name: string): string {
  if (kind === 'Image') return '📷 Ảnh';
  if (kind === 'Audio') return '🎤 Tin nhắn thoại';
  return `📎 ${name}`;
}

/** Đuôi tệp theo kiểu đã chuẩn hoá (đặt tên tệp lưu trên Storage) */
export function extOfMime(mime: string, fileName: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (fromName && MIME_BY_EXT[fromName] === mime) return fromName;
  return Object.entries(MIME_BY_EXT).find(([, m]) => m === mime)?.[0] ?? (mime === 'video/webm' ? 'webm' : 'bin');
}

/** Độ dài ghi âm (giây) khách gửi kèm: số nguyên 1..MAX_AUDIO_SECONDS, sai thì bỏ */
export function parseDuration(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_AUDIO_SECONDS) : null;
}
