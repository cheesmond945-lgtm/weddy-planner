import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { fail, matches, UUID } from './admin-common';

const QUAL_OUT: Record<string, string> = { Pending: 'UNRATED', Qualified: 'QUALIFIED', NotQualified: 'UNQUALIFIED' };
const QUAL_IN: Record<string, string> = { UNRATED: 'Pending', QUALIFIED: 'Qualified', UNQUALIFIED: 'NotQualified' };

export interface ConsultationQueryDto {
  /** Chỉ lấy đúng một yêu cầu (mở từ thông báo) */
  id?: string;
  q?: string;
  categorySlug?: string;
  contacted?: string;
  qualification?: string;
  page?: string | number;
  pageSize?: string | number;
}

export interface UpdateConsultationDto {
  isContacted?: boolean;
  qualification?: string;
  note?: string | null;
}

type ConsultationDto = { isContacted: boolean; qualification: string; vendorAccountCreated: boolean };

/** Thứ tự ưu tiên khi hiển thị: 0 chưa liên hệ, 1 đã liên hệ chờ đánh giá, 2 đạt chờ tạo tài khoản, 3 đã xong. */
const priority = (c: ConsultationDto) => (!c.isContacted ? 0 : c.qualification === 'UNRATED' ? 1 : c.qualification === 'QUALIFIED' && !c.vendorAccountCreated ? 2 : 3);

/** Yêu cầu tư vấn của nhà cung cấp (bảng consultation_requests). */
@Injectable()
export class AdminConsultationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async dto(rows: Awaited<ReturnType<AdminConsultationsService['load']>>) {
    // Đã tạo tài khoản NCC = có tài khoản vai trò Vendor trùng email của yêu cầu
    const vendors = await this.prisma.users.findMany({ where: { role: 'Vendor', email: { in: rows.map((r) => r.email.toLowerCase()) } }, select: { email: true } });
    const have = new Set(vendors.map((v) => v.email.toLowerCase()));
    return rows.map((r) => ({
      id: r.id,
      brandName: r.brand_name,
      category: { id: r.service_categories.id, slug: categorySlug(r.service_categories.name), name: r.service_categories.name },
      contactName: r.contact_name,
      phone: r.phone_number,
      email: r.email,
      createdAt: r.created_date.toISOString(),
      isContacted: r.is_contacted,
      contactedAt: r.contacted_date?.toISOString() ?? null,
      qualification: QUAL_OUT[r.qualification] ?? 'UNRATED',
      note: r.admin_note,
      vendorAccountCreated: have.has(r.email.toLowerCase()),
    }));
  }

  private async hasVendorAccount(email: string) {
    return !!(await this.prisma.users.findFirst({ where: { role: 'Vendor', email: email.toLowerCase() }, select: { id: true } }));
  }

  private load(where: object = {}) {
    return this.prisma.consultation_requests.findMany({ where, include: { service_categories: true }, orderBy: [{ created_date: 'desc' }, { id: 'asc' }] });
  }

  async list(q: ConsultationQueryDto) {
    const all = await this.load();
    const items = (await this.dto(all))
      .filter(
        (c) =>
          (!q.id || c.id === q.id) &&
          matches(q.q, c.brandName, c.contactName, c.phone, c.email) &&
          (!q.categorySlug || c.category.slug === q.categorySlug) &&
          (!q.contacted || (q.contacted === 'YES') === c.isContacted) &&
          (!q.qualification || c.qualification === q.qualification),
      )
      // Việc cần xử lý lên trước: chưa liên hệ, rồi chờ đánh giá, rồi chờ tạo tài khoản; đã xong xuống cuối.
      // Ba nhóm đầu xếp cũ nhất trước (chờ lâu nhất được xử lý trước), nhóm đã xong xếp mới nhất trước.
      .sort((x, y) => priority(x) - priority(y) || (priority(x) < 3 ? x.createdAt.localeCompare(y.createdAt) : y.createdAt.localeCompare(x.createdAt)));
    const size = Math.min(200, Math.max(1, Math.trunc(Number(q.pageSize)) || 10));
    const lastPage = Math.max(1, Math.ceil(items.length / size));
    const page = Math.min(lastPage, Math.max(1, Math.trunc(Number(q.page)) || 1));
    return {
      stats: { total: all.length, uncontacted: all.filter((c) => !c.is_contacted).length, contacted: all.filter((c) => c.is_contacted).length },
      items: items.slice((page - 1) * size, page * size),
      total: items.length,
      page,
    };
  }

  async update(id: string, body: UpdateConsultationDto) {
    const row = UUID.test(id) ? await this.prisma.consultation_requests.findUnique({ where: { id } }) : null;
    if (!row) return fail('CONSULTATION_NOT_FOUND', 'Không tìm thấy yêu cầu tư vấn.', 404);

    const data: Record<string, unknown> = { updated_date: new Date() };
    if (body.isContacted !== undefined) {
      // Tích "đã liên hệ" thì hệ thống tự ghi thời điểm tích
      if (!body.isContacted && row.is_contacted) return fail('VALIDATION_ERROR', 'Đã liên hệ thì không bỏ được trạng thái này.', 409);
      data.is_contacted = !!body.isContacted;
      data.contacted_date = body.isContacted ? (row.contacted_date ?? new Date()) : null;
    }
    const note = body.note === undefined ? undefined : body.note?.trim() || null;
    if (note && note.length > 1000) return fail('VALIDATION_ERROR', 'Ghi chú tối đa 1000 ký tự.', 400);
    if (body.qualification !== undefined) {
      if (!(body.qualification in QUAL_IN)) return fail('VALIDATION_ERROR', 'Đánh giá không hợp lệ.', 400);
      const target = QUAL_IN[body.qualification];
      const contacted = body.isContacted ?? row.is_contacted;
      if (target !== 'Pending' && !contacted) return fail('VALIDATION_ERROR', 'Chỉ đánh giá được sau khi đã liên hệ nhà cung cấp.', 409);
      if (target === 'NotQualified' && !(note ?? row.admin_note)) return fail('VALIDATION_ERROR', 'Cần ghi chú khi đánh giá chưa đạt.', 400, { note: 'Nhập ghi chú khi đánh giá chưa đạt.' });
      if (target !== row.qualification && (await this.hasVendorAccount(row.email))) return fail('VALIDATION_ERROR', 'Đã tạo tài khoản nhà cung cấp nên không đổi được đánh giá.', 409);
      data.qualification = target;
    }
    if (note !== undefined) data.admin_note = note;
    await this.prisma.consultation_requests.update({ where: { id }, data });
    return (await this.dto(await this.load({ id })))[0];
  }

  /** Xóa yêu cầu chưa liên hệ (spam, sai số). Đã liên hệ là đã có trao đổi nên giữ lại để lưu vết, kết thúc bằng đánh giá. Xóa xong, số điện thoại được giải phóng để nhà cung cấp gửi lại. */
  async remove(id: string) {
    const row = UUID.test(id) ? await this.prisma.consultation_requests.findUnique({ where: { id } }) : null;
    if (!row) return fail('CONSULTATION_NOT_FOUND', 'Không tìm thấy yêu cầu tư vấn.', 404);
    if (row.is_contacted) return fail('CONSULTATION_CONTACTED', 'Yêu cầu đã liên hệ nên không thể xóa. Hãy đánh giá đạt hoặc chưa đạt để kết thúc.', 409);
    if (await this.hasVendorAccount(row.email)) return fail('CONSULTATION_HAS_ACCOUNT', 'Yêu cầu đã tạo tài khoản nhà cung cấp nên không thể xóa.', 409);
    // Xóa luôn thông báo trỏ tới yêu cầu này để chuông không dẫn tới yêu cầu đã mất
    await this.prisma.$transaction([
      this.prisma.notifications.deleteMany({ where: { reference_type: 'ConsultationRequest', reference_id: id } }),
      this.prisma.consultation_requests.delete({ where: { id } }),
    ]);
    return null;
  }
}
