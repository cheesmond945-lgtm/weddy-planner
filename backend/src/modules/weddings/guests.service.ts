import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { guestKey, parseGroup, type Rsvp, type Side } from './import-rows';
import { WeddingsService } from './weddings.service';
import { requireDbFeature } from '../../prisma/db-features';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tối đa số khách (dòng) của một đám cưới. */
export const MAX_GUESTS = 2000;

const SIDE_DTO = { Bride: 'BRIDE', Groom: 'GROOM' } as const;
const SIDE_DB: Record<string, Side> = { BRIDE: 'Bride', GROOM: 'Groom' };
const RSVP_DTO = { Pending: 'PENDING', Attending: 'ATTENDING', Declined: 'DECLINED' } as const;
const RSVP_DB: Record<string, Rsvp> = { PENDING: 'Pending', ATTENDING: 'Attending', DECLINED: 'Declined' };

export interface GuestBody {
  fullName?: unknown;
  side?: unknown;
  group?: unknown;
  partySize?: unknown;
  isInvited?: unknown;
  rsvp?: unknown;
}

type GuestRecord = { id: string; full_name: string; side: string; group_name: string; party_size: number; is_invited: boolean; rsvp_status: string; created_date: Date };

const toGuest = (g: GuestRecord) => ({
  id: g.id,
  fullName: g.full_name,
  side: SIDE_DTO[g.side as Side],
  group: g.group_name,
  partySize: g.party_size,
  isInvited: g.is_invited,
  rsvp: RSVP_DTO[g.rsvp_status as Rsvp],
  createdDate: g.created_date.toISOString(),
});

/** Thống kê theo số người (party_size), dùng ở tab Khách mời và Tổng quan. */
export function guestStats(guests: { side: string; party_size: number; is_invited: boolean; rsvp_status: string }[], expected: number) {
  const sum = (f: (g: (typeof guests)[number]) => boolean) => guests.filter(f).reduce((s, g) => s + g.party_size, 0);
  return {
    total: sum(() => true),
    expected,
    invited: sum((g) => g.is_invited),
    attending: sum((g) => g.rsvp_status === 'Attending'),
    declined: sum((g) => g.rsvp_status === 'Declined'),
    pending: sum((g) => g.is_invited && g.rsvp_status === 'Pending'),
    notInvited: sum((g) => !g.is_invited),
    bride: sum((g) => g.side === 'Bride'),
    groom: sum((g) => g.side === 'Groom'),
    rows: guests.length,
  };
}

/** Khách mời (P5). Trùng khách theo tên (bỏ dấu) + bên. */
@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService, private readonly weddings: WeddingsService) {}

  async list(userId: string) {
    requireDbFeature('guests');
    const w = await this.weddings.requireWedding(userId);
    const rows = await this.prisma.wedding_guests.findMany({ where: { wedding_id: w.id }, orderBy: [{ created_date: 'asc' }, { id: 'asc' }] });
    return { items: rows.map(toGuest), stats: guestStats(rows, w.guest_count ?? 0) };
  }

  /** Khóa trùng của khách hiện có (bỏ qua một khách khi đang sửa chính khách đó). */
  async existingKeys(weddingId: string, exceptId?: string) {
    const rows = await this.prisma.wedding_guests.findMany({ where: { wedding_id: weddingId }, select: { id: true, full_name: true, side: true } });
    return new Set(rows.filter((r) => r.id !== exceptId).map((r) => guestKey(r.full_name, r.side as Side)));
  }

  /** Kiểm tra body; `partial` khi sửa (chỉ kiểm tra trường có gửi). Phản hồi chỉ khác PENDING khi đã mời. */
  private check(body: GuestBody, current?: GuestRecord) {
    const errors: Record<string, string> = {};
    const data: Partial<{ full_name: string; side: Side; group_name: string; party_size: number; is_invited: boolean; rsvp_status: Rsvp }> = {};
    if (!current || body.fullName !== undefined) {
      const name = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : '';
      if (!name) errors.fullName = 'Nhập tên khách.';
      else if (name.length > 100) errors.fullName = 'Tối đa 100 ký tự.';
      else data.full_name = name;
    }
    if (!current || body.side !== undefined) {
      const side = SIDE_DB[String(body.side)];
      if (!side) errors.side = 'Chọn Nhà trai hoặc Nhà gái.';
      else data.side = side;
    }
    if (!current || body.group !== undefined) {
      const group = parseGroup(body.group);
      if (group === null) errors.group = 'Nhóm tối đa 30 ký tự.';
      else data.group_name = group;
    }
    if (!current || body.partySize !== undefined) {
      const n = body.partySize === undefined ? 1 : Number(body.partySize);
      if (!Number.isInteger(n) || n < 1 || n > 50) errors.partySize = 'Số người là số nguyên từ 1 đến 50.';
      else data.party_size = n;
    }
    if (body.isInvited !== undefined) {
      if (typeof body.isInvited !== 'boolean') errors.isInvited = 'Giá trị không hợp lệ.';
      else data.is_invited = body.isInvited;
    }
    if (body.rsvp !== undefined) {
      const r = RSVP_DB[String(body.rsvp)];
      if (!r) errors.rsvp = 'Phản hồi không hợp lệ.';
      else data.rsvp_status = r;
    }
    const invited = data.is_invited ?? current?.is_invited ?? false;
    if (!invited) {
      // Bỏ "đã mời" thì phản hồi về chưa phản hồi; chưa mời thì không chọn được phản hồi
      if (data.rsvp_status && data.rsvp_status !== 'Pending' && body.isInvited === undefined) errors.rsvp = 'Đánh dấu đã mời trước khi chọn phản hồi.';
      data.rsvp_status = 'Pending';
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin khách chưa hợp lệ.', 400, errors);
    return data;
  }

  private async capacityLeft(weddingId: string, adding: number) {
    if ((await this.prisma.wedding_guests.count({ where: { wedding_id: weddingId } })) + adding > MAX_GUESTS) {
      return fail('GUEST_LIMIT', `Tối đa ${MAX_GUESTS} khách.`, 409);
    }
  }

  async create(userId: string, body: GuestBody) {
    requireDbFeature('guests');
    const w = await this.weddings.requireWedding(userId);
    const data = this.check(body) as Required<ReturnType<GuestsService['check']>>;
    if ((await this.existingKeys(w.id)).has(guestKey(data.full_name, data.side))) return fail('GUEST_DUPLICATE', 'Khách này đã có trong danh sách.', 409);
    await this.capacityLeft(w.id, 1);
    await this.prisma.wedding_guests.create({ data: { ...data, wedding_id: w.id } });
    return this.list(userId);
  }

  /** Thêm nhiều khách: mỗi dòng một tên, chung bên và nhóm. Bỏ dòng trống; tên trùng (trong danh sách hoặc đã có) trả lỗi kèm tên. */
  async bulk(userId: string, body: { names?: unknown; side?: unknown; group?: unknown }) {
    requireDbFeature('guests');
    const w = await this.weddings.requireWedding(userId);
    const raw = Array.isArray(body.names) ? body.names : typeof body.names === 'string' ? body.names.split(/\r?\n/) : [];
    const names = raw.map((n) => String(n).trim().replace(/\s+/g, ' ')).filter(Boolean);
    const side = SIDE_DB[String(body.side)];
    const group = parseGroup(body.group);
    const errors: Record<string, string> = {};
    if (!names.length) errors.names = 'Nhập ít nhất một tên.';
    else if (names.length > 500) errors.names = 'Tối đa 500 tên mỗi lần.';
    else if (names.some((n) => n.length > 100)) errors.names = 'Mỗi tên tối đa 100 ký tự.';
    if (!side) errors.side = 'Chọn Nhà trai hoặc Nhà gái.';
    if (group === null) errors.group = 'Nhóm tối đa 30 ký tự.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Danh sách khách chưa hợp lệ.', 400, errors);

    const have = await this.existingKeys(w.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const n of names) {
      const k = guestKey(n, side!);
      if (have.has(k) || seen.has(k)) duplicates.push(n);
      seen.add(k);
    }
    if (duplicates.length) return fail('GUEST_DUPLICATE', 'Có tên đã có trong danh sách.', 409, { duplicates });
    await this.capacityLeft(w.id, names.length);
    await this.prisma.wedding_guests.createMany({ data: names.map((n) => ({ wedding_id: w.id, full_name: n, side: side!, group_name: group! })) });
    return this.list(userId);
  }

  private async guest(weddingId: string, id: string) {
    const g = UUID.test(id) ? await this.prisma.wedding_guests.findFirst({ where: { id, wedding_id: weddingId } }) : null;
    return g ?? fail('GUEST_NOT_FOUND', 'Không tìm thấy khách.', 404);
  }

  async update(userId: string, id: string, body: GuestBody) {
    requireDbFeature('guests');
    const w = await this.weddings.requireWedding(userId);
    const g = await this.guest(w.id, id);
    const data = this.check(body, g);
    const name = data.full_name ?? g.full_name;
    const side = data.side ?? (g.side as Side);
    if ((data.full_name || data.side) && (await this.existingKeys(w.id, id)).has(guestKey(name, side))) return fail('GUEST_DUPLICATE', 'Khách này đã có trong danh sách.', 409);
    await this.prisma.wedding_guests.update({ where: { id }, data: { ...data, updated_date: new Date() } });
    return this.list(userId);
  }

  async remove(userId: string, id: string) {
    requireDbFeature('guests');
    const w = await this.weddings.requireWedding(userId);
    await this.guest(w.id, id);
    await this.prisma.wedding_guests.delete({ where: { id } });
    return this.list(userId);
  }
}
