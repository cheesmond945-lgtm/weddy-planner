import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { containsBannedWord } from '../../common/utils/banned-words';
import { ServicesService } from '../catalog/services.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_LEN = 10;
const MAX_LEN = 1000;

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

/** Mã lỗi do trigger DB (RAISE EXCEPTION 'REVIEW_...: ...') -> HTTP status. */
const DB_ERROR_STATUS: Record<string, number> = { REVIEW_NOT_ELIGIBLE: 409, REVIEW_INVALID_LENGTH: 400, REVIEW_BANNED_CONTENT: 400 };

const todayVN = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export interface ReviewBody {
  rating?: unknown;
  content?: unknown;
}

/** Đánh giá của cặp đôi theo từng dòng đơn (order_items), hiển thị chung ở trang nhà cung cấp (docs/api/reviews.md). */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly services: ServicesService) {}

  private own(r: any) {
    return { id: r.id, orderItemId: r.order_item_id, rating: r.rating, content: r.content, createdAt: r.created_date, updatedAt: r.updated_date };
  }

  private toDto(r: any) {
    const oi = r.order_items;
    return {
      ...this.own(r),
      packageName: oi?.service_packages?.name ?? oi?.item_name ?? null,
      customerName: oi?.orders?.weddings?.users?.full_name ?? oi?.orders?.customer_name ?? 'Khách hàng',
    };
  }

  private async visibleVendor(vendorId: string) {
    if (!UUID.test(vendorId) || !(await this.services.isVisible(vendorId))) fail('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.', 404);
  }

  /** Điểm trung bình (1 chữ số) và số lượt đánh giá của nhà cung cấp; chưa có đánh giá thì average = null. */
  async summary(vendorId: string) {
    await this.visibleVendor(vendorId);
    const agg = await this.prisma.reviews.aggregate({ where: { order_items: { orders: { vendor_id: vendorId } } }, _avg: { rating: true }, _count: { _all: true } });
    return { count: agg._count._all, average: agg._avg.rating == null ? null : Math.round(agg._avg.rating * 10) / 10 };
  }

  async listForVendor(vendorId: string, query: { page?: string; pageSize?: string }) {
    await this.visibleVendor(vendorId);
    const page = Math.max(1, Math.floor(Number(query.page)) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(query.pageSize)) || 10));
    const where = { order_items: { orders: { vendor_id: vendorId } } };
    const [total, rows] = await Promise.all([
      this.prisma.reviews.count({ where }),
      this.prisma.reviews.findMany({
        where,
        orderBy: [{ created_date: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { order_items: { include: { service_packages: { select: { name: true } }, orders: { include: { weddings: { include: { users: { select: { full_name: true } } } } } } } } },
      }),
    ]);
    return { items: rows.map((r) => this.toDto(r)), page, pageSize, total };
  }

  /** Các dòng của một đơn kèm đánh giá hiện có và việc có đánh giá được không. */
  async itemsOfOrder(userId: string, orderId: string) {
    const o = UUID.test(orderId)
      ? await this.prisma.orders.findFirst({
          where: { id: orderId, weddings: { user_id: userId }, status: { not: 'Draft' } },
          include: { weddings: true, order_items: { include: { reviews: true, service_packages: { select: { name: true } } }, orderBy: { id: 'asc' } } },
        })
      : null;
    if (!o) return fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    const weddingDate = o.weddings?.wedding_date?.toISOString().slice(0, 10) ?? null;
    const eligible = o.status === 'Completed' && !!weddingDate && weddingDate < todayVN();
    return o.order_items.map((i) => ({
      orderItemId: i.id,
      name: i.service_packages?.name ?? i.item_name,
      review: i.reviews ? this.own(i.reviews) : null,
      canReview: eligible && !i.reviews,
    }));
  }

  private parse(body: ReviewBody) {
    const errors: Record<string, string> = {};
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Điểm đánh giá phải là số nguyên từ 1 đến 5.';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (content.length < MIN_LEN || content.length > MAX_LEN) errors.content = `Nội dung đánh giá phải từ ${MIN_LEN} đến ${MAX_LEN} ký tự.`;
    if (Object.keys(errors).length) fail('VALIDATION_ERROR', 'Đánh giá chưa hợp lệ.', 400, errors);
    if (containsBannedWord(content)) fail('REVIEW_BANNED_CONTENT', 'Nội dung đánh giá chứa ngôn từ không phù hợp.', 400);
    return { rating, content };
  }

  /** Dòng đơn của chính cặp đôi (đơn không phải Draft). */
  private async ownItem(userId: string, itemId: string) {
    const item = UUID.test(itemId)
      ? await this.prisma.order_items.findFirst({ where: { id: itemId, orders: { weddings: { user_id: userId }, status: { not: 'Draft' } } }, include: { reviews: true } })
      : null;
    return item ?? fail('ORDER_ITEM_NOT_FOUND', 'Không tìm thấy dịch vụ trong đơn.', 404);
  }

  /** Chuyển lỗi trigger/unique của DB thành lỗi API. */
  private rethrow(e: unknown): never {
    if (e instanceof HttpException) throw e;
    if ((e as { code?: string })?.code === 'P2002') return fail('REVIEW_ALREADY_EXISTS', 'Dịch vụ này đã được đánh giá.', 409);
    const m = /(REVIEW_[A-Z_]+):\s*([^\n]+)/.exec(String((e as { message?: string })?.message ?? ''));
    if (m && DB_ERROR_STATUS[m[1]]) return fail(m[1], m[2].trim(), DB_ERROR_STATUS[m[1]]);
    throw e;
  }

  async create(userId: string, itemId: string, body: ReviewBody) {
    const item = await this.ownItem(userId, itemId);
    const data = this.parse(body);
    if (item.reviews) fail('REVIEW_ALREADY_EXISTS', 'Dịch vụ này đã được đánh giá.', 409);
    try {
      return this.own(await this.prisma.reviews.create({ data: { order_item_id: item.id, ...data } }));
    } catch (e) {
      return this.rethrow(e);
    }
  }

  async update(userId: string, itemId: string, body: ReviewBody) {
    const item = await this.ownItem(userId, itemId);
    const data = this.parse(body);
    if (!item.reviews) fail('REVIEW_NOT_FOUND', 'Dịch vụ này chưa có đánh giá.', 404);
    try {
      return this.own(await this.prisma.reviews.update({ where: { id: item.reviews!.id }, data }));
    } catch (e) {
      return this.rethrow(e);
    }
  }
}
