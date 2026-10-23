import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const ALBUM_BUCKET = 'package-albums'; // công khai: ảnh gói dịch vụ
export const DOC_BUCKET = 'vendor-documents'; // riêng tư: giấy tờ NCC

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly baseUrl: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SECRET_KEY trong backend/.env');
    this.baseUrl = url.replace(/\/$/, '');
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  /** Cột package_albums.url lưu đường dẫn tương đối, vd "trang-tri/v01/p001/01.jpg" */
  publicAlbumUrl(path: string): string {
    if (/^https?:\/\//.test(path)) return path;
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `${this.baseUrl}/storage/v1/object/public/${ALBUM_BUCKET}/${encoded}`;
  }

  /** Link tạm thời (mặc định 10 phút) để xem giấy tờ trong bucket riêng tư */
  async signedDocumentUrl(path: string, expiresInSec = 600): Promise<string | null> {
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

  /** Xóa file (không báo lỗi nếu file không tồn tại). */
  async remove(bucket: string, paths: string[]) {
    if (paths.length) await this.supabase.storage.from(bucket).remove(paths);
  }
}
