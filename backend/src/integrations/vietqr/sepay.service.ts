import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { matchKey, normalizeContent, vietqrConfig } from './vietqr';

/** Một giao dịch tiền vào do SePay trả về. */
export interface SepayTxn {
  /** Mã giao dịch của SePay (dùng làm mã giao dịch lưu trong DB, chỉ được dùng một lần) */
  id: string;
  amount: number;
  content: string;
  paidAt: Date;
}

interface RawTxn {
  id: string | number;
  amount_in: string | number;
  transaction_content: string | null;
  transaction_date: string;
}

const CACHE_MS = 3000;

/**
 * Đối chiếu giao dịch qua API của SePay (API v2, GET {SEPAY_API_BASE}/v2/transactions). SePay giới hạn khoảng 2 lần gọi mỗi giây,
 * nên danh sách được giữ vài giây để nhiều người cùng chờ không làm vượt hạn mức.
 */
@Injectable()
export class SepayService {
  private readonly log = new Logger(SepayService.name);
  private cache: { at: number; list: SepayTxn[] } | null = null;
  private inflight: Promise<SepayTxn[]> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async recent(): Promise<SepayTxn[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.list;
    this.inflight ??= this.fetchRecent().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async fetchRecent(): Promise<SepayTxn[]> {
    const cfg = vietqrConfig()!;
    const base = (process.env.SEPAY_API_BASE?.trim() || 'https://userapi.sepay.vn').replace(/\/$/, '');
    const url = `${base}/v2/transactions?limit=100`;
    let body: { data?: RawTxn[]; transactions?: RawTxn[] };
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.sepayToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = (await res.json()) as { data?: RawTxn[]; transactions?: RawTxn[] };
    } catch (e) {
      this.log.error(`Gọi SePay lỗi: ${(e as Error).message}`);
      throw new HttpException({ code: 'PAYMENT_PROVIDER_ERROR', message: 'Chưa kiểm tra được giao dịch, vui lòng thử lại sau ít giây.' }, 502);
    }
    const list = (body.data ?? body.transactions ?? [])
      .map((t) => ({
        id: String(t.id),
        amount: Number(t.amount_in),
        content: t.transaction_content ?? '',
        // SePay trả "yyyy-MM-dd HH:mm:ss" theo giờ Việt Nam
        paidAt: new Date(`${t.transaction_date.replace(' ', 'T')}+07:00`),
      }))
      .filter((t) => t.amount > 0);
    this.cache = { at: Date.now(), list };
    return list;
  }

  /** Mã giao dịch đã gắn với một đơn cọc hoặc bảng kê hoa hồng khác: mỗi giao dịch chỉ dùng được một lần. */
  private async isUsed(txnId: string) {
    const [a, b] = await Promise.all([
      this.prisma.payments.findUnique({ where: { transaction_code: txnId }, select: { id: true } }),
      this.prisma.commission_statements.findUnique({ where: { transaction_code: txnId }, select: { id: true } }),
    ]);
    return !!(a || b);
  }

  /**
   * Tìm giao dịch tiền vào có nội dung chứa `content` và số tiền đúng bằng `amount` mà chưa dùng cho khoản nào.
   * Trả null nếu chưa thấy.
   */
  async findPayment(content: string, amount: number): Promise<SepayTxn | null> {
    const need = matchKey(content);
    for (const t of await this.recent()) {
      if (Math.round(t.amount) !== Math.round(amount) || !normalizeContent(t.content).includes(need)) continue;
      if (await this.isUsed(t.id)) continue;
      return t;
    }
    return null;
  }
}
