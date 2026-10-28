import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fail, UUID } from '../admin/admin-common';

const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateConsultationDto {
  brandName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  categoryId?: string;
}

/** Nhà cung cấp gửi đăng ký tư vấn hợp tác (công khai, không cần đăng nhập). Hiện ở trang Yêu cầu tư vấn của Admin. */
@Injectable()
export class ConsultationRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(b: CreateConsultationDto) {
    const brandName = b.brandName?.trim() ?? '';
    const contactName = b.contactName?.trim() ?? '';
    const phone = b.phone?.trim() ?? '';
    const email = b.email?.trim().toLowerCase() ?? '';
    const errors: Record<string, string> = {};
    if (!brandName || brandName.length > 150) errors.brandName = 'Nhập tên thương hiệu (tối đa 150 ký tự).';
    if (!contactName || contactName.length > 100) errors.contactName = 'Nhập tên người liên hệ (tối đa 100 ký tự).';
    if (!PHONE_RE.test(phone)) errors.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.';
    if (!EMAIL_RE.test(email) || email.length > 255) errors.email = 'Email chưa hợp lệ.';
    const category = UUID.test(b.categoryId ?? '') ? await this.prisma.service_categories.findUnique({ where: { id: b.categoryId! } }) : null;
    if (!category) errors.categoryId = 'Chọn lĩnh vực hoạt động.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin đăng ký chưa hợp lệ.', 400, errors);

    // Email là danh tính đăng nhập: đã có tài khoản thì không đăng ký tư vấn nữa
    const account = await this.prisma.users.findFirst({ where: { email }, select: { role: true } });
    if (account?.role === 'Vendor') return fail('EMAIL_ALREADY_EXISTS', 'Email này đã có tài khoản nhà cung cấp. Vui lòng đăng nhập.', 409);
    if (account) return fail('EMAIL_ALREADY_EXISTS', 'Email này đã được dùng để đăng ký tài khoản cặp đôi. Để trở thành nhà cung cấp, vui lòng đăng ký bằng một email khác.', 409);
    // Cùng quy tắc với lúc Admin tạo tài khoản, để yêu cầu lọt qua form không bị chặn ở bước cuối
    if (await this.prisma.users.findFirst({ where: { phone_number: phone } })) return fail('PHONE_ALREADY_EXISTS', 'Số điện thoại này đã gắn với một tài khoản trên hệ thống.', 409);

    // Số điện thoại (kênh liên hệ Zalo) đã có yêu cầu thì không tạo thêm, không ghi đè: chống gửi trùng và chống dùng số người khác.
    // Email trùng yêu cầu cũ thì vẫn cho gửi, vì đây là cách nhà cung cấp gửi lại khi nhập sai số điện thoại; Admin xóa bản sai.
    if (await this.prisma.consultation_requests.findFirst({ where: { phone_number: phone } })) {
      return fail('CONSULTATION_ALREADY_EXISTS', 'Số điện thoại này đã gửi yêu cầu. Vui lòng chờ chúng tôi liên hệ.', 409);
    }

    const created = await this.prisma.consultation_requests.create({
      data: { category_id: category!.id, brand_name: brandName, contact_name: contactName, phone_number: phone, email },
    });
    // Báo cho mọi Admin biết có yêu cầu mới (hiện ở chuông thông báo)
    const admins = await this.prisma.users.findMany({ where: { role: 'Admin' }, select: { id: true } });
    if (admins.length) {
      await this.prisma.notifications.createMany({
        data: admins.map((u) => ({
          user_id: u.id,
          type: 'NewConsultationRequest',
          title: `Yêu cầu tư vấn mới: ${brandName}`,
          content: `${contactName} (${phone}) muốn hợp tác.`,
          reference_type: 'ConsultationRequest',
          reference_id: created.id,
        })),
      });
    }
    return { ok: true };
  }
}
