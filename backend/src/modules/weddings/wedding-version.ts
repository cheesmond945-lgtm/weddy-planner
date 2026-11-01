import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

type Tx = Pick<PrismaService, 'weddings'>;

/** Phiên bản của đám cưới (weddings.updated_date dạng ISO) gửi kèm mỗi lần ghi để phát hiện ghi đồng thời. */
export const versionOf = (w: { updated_date: Date }) => w.updated_date.toISOString();

/**
 * Ghi có kiểm tra phiên bản: chỉ đổi updated_date khi bản trong DB đúng là bản người gọi đã đọc.
 * Người ghi sau nhận 409 STALE_DATA, không ghi đè im lặng. Gọi trong cùng giao dịch với phần ghi.
 * DB lưu tới micro giây, JS tới mili giây: so trong khoảng 1 ms.
 */
export async function bumpVersion(tx: Tx, weddingId: string, version: unknown) {
  if (typeof version !== 'string' || Number.isNaN(Date.parse(version))) {
    throw new HttpException({ code: 'VERSION_REQUIRED', message: 'Thiếu phiên bản dữ liệu, hãy tải lại trang.' }, 400);
  }
  const at = new Date(version);
  const r = await tx.weddings.updateMany({
    where: { id: weddingId, updated_date: { gte: at, lt: new Date(at.getTime() + 1) } },
    data: { updated_date: new Date() },
  });
  if (!r.count) throw new HttpException({ code: 'STALE_DATA', message: 'Đã có thay đổi, hãy tải lại.' }, 409);
}
