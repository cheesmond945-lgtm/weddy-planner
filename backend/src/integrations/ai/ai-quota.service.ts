import { HttpException, Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface Usage {
  /** Ngày (giờ Việt Nam) của bộ đếm, yyyy-MM-dd */
  day: string;
  used: number;
}

export interface AiQuota {
  limit: number;
  remaining: number;
  /** Thời điểm bộ đếm về 0 (0 giờ ngày mai, giờ Việt Nam) */
  resetsAt: string;
}

/**
 * Giới hạn số lượt "Tạo với AI" mỗi NCC mỗi ngày (AI_DAILY_LIMIT, mặc định 10; cả hồ sơ lẫn gói dùng chung một quỹ lượt).
 * Chỉ tính lượt khi AI viết thật (đoạn mẫu dự phòng không tính). Bộ đếm lưu ở backend/.data/ai-usage.json để không mất khi khởi động lại
 * và không cần sửa CSDL; chạy nhiều bản backend song song thì mỗi bản đếm riêng.
 */
@Injectable()
export class AiQuotaService {
  private readonly log = new Logger(AiQuotaService.name);
  private readonly file = resolve(process.cwd(), '.data', 'ai-usage.json');
  private usage: Record<string, Usage> = this.load();

  get limit() {
    const n = Math.trunc(Number(process.env.AI_DAILY_LIMIT));
    return n > 0 ? n : 10;
  }

  private load(): Record<string, Usage> {
    try {
      return existsSync(this.file) ? (JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, Usage>) : {};
    } catch {
      return {};
    }
  }

  private save() {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.usage));
    } catch (e) {
      this.log.warn(`Không ghi được bộ đếm lượt AI: ${(e as Error).message}`);
    }
  }

  /** Ngày hiện tại theo giờ Việt Nam. */
  private today() {
    return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  }

  status(userId: string): AiQuota {
    const u = this.usage[userId];
    const used = u && u.day === this.today() ? u.used : 0;
    const resetsAt = new Date(new Date(`${this.today()}T00:00:00+07:00`).getTime() + 86_400_000).toISOString();
    return { limit: this.limit, remaining: Math.max(0, this.limit - used), resetsAt };
  }

  /** Hết lượt thì dừng ngay (429), không gọi Gemini. */
  assertAvailable(userId: string) {
    if (this.status(userId).remaining <= 0) {
      throw new HttpException({ code: 'AI_LIMIT_REACHED', message: `Bạn đã dùng hết ${this.limit} lượt tạo với AI hôm nay. Lượt mới có từ 0 giờ ngày mai.` }, 429);
    }
  }

  /** Trừ một lượt (gọi sau khi AI viết thành công) và trả quỹ lượt còn lại. */
  consume(userId: string): AiQuota {
    const day = this.today();
    const u = this.usage[userId];
    this.usage[userId] = { day, used: (u && u.day === day ? u.used : 0) + 1 };
    for (const [id, x] of Object.entries(this.usage)) if (x.day !== day) delete this.usage[id];
    this.save();
    return this.status(userId);
  }
}
