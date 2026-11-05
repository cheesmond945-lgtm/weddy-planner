import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const ALBUM_BUCKET = 'package-albums'; // công khai: ảnh gói dịch vụ
export const DOC_BUCKET = 'vendor-documents'; // riêng tư: giấy tờ NCC
export const CHAT_BUCKET = 'chat-files'; // riêng tư: ảnh / tệp / ghi âm gửi trong chat

/** Link ký của tệp chat sống 1 giờ; dùng lại cùng link trong 50 phút để tải lại danh sách tin không làm ảnh tải lại */
const CHAT_URL_TTL_SEC = 3600;
const CHAT_URL_REUSE_MS = 50 * 60_000;

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly baseUrl: string;
  private readonly chatUrls = new Map<string, { url: string; until: number }>();

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SECRET_KEY trong backend/.env');
    this.baseUrl = url.replace(/\/$/, '');
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  /** Cột package_albums.url lưu đường dẫn tương đối, vd "trang-tri/v01/p001/01.jpg" */
  publicAlbumUrl(path: string | null): string {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `${this.baseUrl}/storage/v1/object/public/${ALBUM_BUCKET}/${encoded}`;
  }

  /** Link tạm thời (mặc định 10 phút) để xem giấy tờ trong bucket riêng tư */
  async signedDocumentUrl(path: string | null, expiresInSec = 600): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await this.supabase.storage.from(DOC_BUCKET).createSignedUrl(path, expiresInSec);
    return error ? null : data.signedUrl;
  }

  /** Upload ảnh gói mới (dùng khi NCC thêm ảnh từ giao diện) */
  async uploadAlbum(path: string, file: Buffer, contentType: string) {
    const { error } = await this.supabase.storage.from(ALBUM_BUCKET).upload(path, file, { contentType, upsert: false });
    if (error) throw error;
    return this.publicAlbumUrl(path);
  }

  async uploadDocument(path: string, file: Buffer, contentType: string) {
    const { error } = await this.supabase.storage.from(DOC_BUCKET).upload(path, file, { contentType, upsert: true });
    if (error) throw error;
    return path;
  }

  /** Upload tổng quát; trả về đường dẫn đã lưu. Lỗi (sai định dạng, quá dung lượng...) ném Error có message của Supabase. */
  async upload(bucket: string, path: string, file: Buffer, contentType: string) {
    const { error } = await this.supabase.storage.from(bucket).upload(path, file, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }

  /** Link ký tạm cho các tệp chat (path → url); tệp ký lỗi thì không có trong Map. */
  async signedChatUrls(paths: string[]): Promise<Map<string, string>> {
    const now = Date.now();
    const out = new Map<string, string>();
    const missing: string[] = [];
    for (const p of new Set(paths)) {
      const hit = this.chatUrls.get(p);
      if (hit && hit.until > now) out.set(p, hit.url);
      else missing.push(p);
    }
    if (missing.length) {
      const { data } = await this.supabase.storage.from(CHAT_BUCKET).createSignedUrls(missing, CHAT_URL_TTL_SEC);
      for (const row of data ?? []) {
        if (!row.path || !row.signedUrl) continue;
        out.set(row.path, row.signedUrl);
        this.chatUrls.set(row.path, { url: row.signedUrl, until: now + CHAT_URL_REUSE_MS });
      }
    }
    return out;
  }

  /** Xóa file (không báo lỗi nếu file không tồn tại). */
  async remove(bucket: string, paths: string[]) {
    if (paths.length) await this.supabase.storage.from(bucket).remove(paths);
  }
}
