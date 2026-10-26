/** Tiện ích chung cho tệp của NCC lưu trên Supabase Storage (đường dẫn trong cột url, không lưu tên/kích thước/mime). */

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

export const mimeOfPath = (path: string | null) => MIME_BY_EXT[path?.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Tệp upload qua API có tên "<uuid>_<tên gốc>"; tệp dữ liệu mẫu chỉ có tên thường. */
export const fileNameOfPath = (path: string | null) => (path?.split('/').pop() ?? '').replace(/^[0-9a-f-]{36}_/, '');

/** Tên tệp an toàn để đưa vào đường dẫn Storage (bỏ dấu, chỉ chữ-số-gạch). */
export function safeBaseName(original: string) {
  const base = original.replace(/\.[^.]*$/, '');
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || 'file';
}

/** multer đọc tên tệp UTF-8 như latin1; đổi lại cho đúng. */
export const decodeFileName = (name: string) => Buffer.from(name, 'latin1').toString('utf8');
