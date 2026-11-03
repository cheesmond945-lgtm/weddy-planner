/*
 * Dựng lại timeline KHUNG của MỌI đám cưới theo mẫu mới (src/modules/weddings/timeline-templates.ts), thay việc khung cũ.
 * Việc chi tiết của đơn (lấy từ gói của NCC, gắn đơn) KHÔNG bị đụng. KHÔNG chạy trong đợt này.
 *
 *   npm run timelines:rebuild             DRY-RUN (mặc định): chỉ đọc CSDL, in bảng, không ghi gì
 *   npm run timelines:rebuild -- --apply  ghi thật; mỗi đám cưới một transaction
 *
 * Mỗi đám cưới:
 *   - GIỮ việc khách tự thêm (task_code rỗng).
 *   - GIỮ việc chi tiết gắn đơn (order_id khác rỗng).
 *   - XÓA các việc khung sinh từ mẫu cũ (task_type Frame, task_code khác rỗng, không gắn đơn).
 *   - Sinh lại việc khung với I = ngày tạo đám cưới (giờ VN), W = ngày cưới hiện tại.
 *   - Mỗi dịch vụ có đơn Deposited / Completed: Mốc chốt của dịch vụ đó xong (đơn Deposited cọc mới nhất trước, rồi Completed).
 *   - Bỏ qua đám cưới chưa có ngày cưới, hoặc ngày cưới không sau ngày tạo.
 * Chỉ đọc weddings, orders, payments, service_categories, users; chỉ ghi timeline_tasks.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { frameRows, type ServiceRef, type TaskRow } from '../src/modules/weddings/timeline-rows';
import { dayOf } from '../src/modules/weddings/timeline-schedule';
import { serviceKeyOf, TIMELINE_TEMPLATES } from '../src/modules/weddings/timeline-templates';

const apply = process.argv.includes('--apply');
const vnYmd = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    const cats = await prisma.service_categories.findMany({ select: { id: true, name: true } });
    const refOf = new Map<string, ServiceRef>();
    for (const c of cats) {
      const key = serviceKeyOf(c.name);
      if (key) refOf.set(c.id, { key, categoryId: c.id });
    }
    const bookCode = (key: string) => TIMELINE_TEMPLATES.find((t) => t.service === key && t.kind === 'BOOK')!.code;

    const weddings = await prisma.weddings.findMany({
      orderBy: { created_date: 'asc' },
      include: {
        users: { select: { full_name: true, username: true } },
        wedding_categories: { select: { category_id: true } },
        orders: { where: { status: { in: ['Deposited', 'Completed'] } }, include: { payments: true, vendor_profiles: { select: { category_id: true } } } },
      },
    });

    const table: Record<string, unknown>[] = [];
    const plans: { id: string; del: number; rows: TaskRow[] }[] = [];

    for (const w of weddings) {
      const base = { 'wedding id': w.id, khách: w.users?.full_name || w.users?.username || '', 'ngày cưới': w.wedding_date ? ymd(w.wedding_date) : '' };
      if (!w.wedding_date) {
        table.push({ ...base, 'ngày tạo (I)': '', L: '', 'đơn cọc': '', xóa: 0, tạo: 0, 'giữ (tự thêm)': 0, 'ghi chú': 'bỏ qua: chưa có ngày cưới' });
        continue;
      }
      const W = ymd(w.wedding_date);
      const I = vnYmd(w.created_date ?? new Date());
      const existing = await prisma.timeline_tasks.findMany({ where: { wedding_id: w.id }, select: { task_code: true, task_type: true, order_id: true } });
      const coded = existing.filter((t) => t.task_code !== null && t.task_type === 'Frame' && t.order_id === null).length;
      const custom = existing.length - coded;
      if (dayOf(W) <= dayOf(I)) {
        table.push({ ...base, 'ngày tạo (I)': I, L: dayOf(W) - dayOf(I), 'đơn cọc': w.orders.length, xóa: 0, tạo: 0, 'giữ (tự thêm)': existing.length, 'ghi chú': 'bỏ qua: ngày cưới không sau ngày tạo, không đụng timeline' });
        continue;
      }

      // Đơn giữ timeline của từng dịch vụ: Deposited (cọc mới nhất) trước Completed
      type Order = (typeof w.orders)[number];
      const paidAt = (o: Order) => o.payments?.paid_date ?? o.created_date ?? new Date(0);
      const sorted = [...w.orders].sort((a, b) => (a.status === b.status ? paidAt(b).getTime() - paidAt(a).getTime() : a.status === 'Deposited' ? -1 : 1));
      const owner = new Map<string, Order>();
      for (const o of sorted) {
        const ref = o.vendor_profiles?.category_id ? refOf.get(o.vendor_profiles.category_id) : undefined;
        if (ref && !owner.has(ref.key)) owner.set(ref.key, o);
      }

      const wanted = new Set<string>(w.wedding_categories.map((c) => c.category_id));
      for (const o of owner.values()) if (o.vendor_profiles?.category_id) wanted.add(o.vendor_profiles.category_id);
      const services = [...wanted].flatMap((id) => (refOf.has(id) ? [refOf.get(id)!] : []));

      const rows = frameRows(TIMELINE_TEMPLATES, { weddingId: w.id, wedding: W, today: I, services });
      for (const [key, o] of owner) {
        const book = rows.find((r) => r.task_code === bookCode(key));
        if (book) {
          book.status = 'Done';
          book.completed_date = paidAt(o);
        }
      }
      plans.push({ id: w.id, del: coded, rows });
      const dup = w.orders.length - owner.size;
      table.push({ ...base, 'ngày tạo (I)': I, L: dayOf(W) - dayOf(I), 'đơn cọc': owner.size, xóa: coded, tạo: rows.length, 'giữ (tự thêm)': custom, 'ghi chú': dup > 0 ? `${dup} đơn cọc trùng dịch vụ` : '' });
    }

    console.log(apply ? '== CHẠY THẬT (--apply) ==' : '== DRY-RUN: không ghi gì vào CSDL ==');
    console.table(table);
    const sum = (k: string) => table.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    console.log(`Tổng: ${table.length} đám cưới, ${plans.length} sẽ dựng lại; xóa ${sum('xóa')}, tạo ${sum('tạo')}, giữ ${sum('giữ (tự thêm)')} việc tự thêm.`);

    if (!apply) {
      console.log('DRY-RUN xong. Thêm --apply để ghi thật.');
      return;
    }
    // Sao lưu TOÀN BỘ dòng sắp xóa (đủ mọi cột) trước khi động vào CSDL; không ghi đè bản sao lưu cũ
    const backupFile = path.join(__dirname, '..', '..', '..', '..', 'scripts', 'backup', `timeline_tasks_${vnYmd(new Date())}.json`);
    if (fs.existsSync(backupFile)) throw new Error(`Đã có bản sao lưu ${backupFile}, xóa hoặc đổi tên rồi chạy lại.`);
    const doomed = await prisma.timeline_tasks.findMany({ where: { wedding_id: { in: plans.map((p) => p.id) }, task_code: { not: null }, task_type: 'Frame', order_id: null }, orderBy: [{ wedding_id: 'asc' }, { scheduled_date: 'asc' }, { id: 'asc' }] });
    const expected = plans.reduce((a, p) => a + p.del, 0);
    if (doomed.length !== expected) throw new Error(`Số dòng sao lưu (${doomed.length}) khác số dòng sẽ xóa (${expected}), dừng.`);
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.writeFileSync(backupFile, JSON.stringify(doomed, null, 2), 'utf8');
    console.log(`Đã sao lưu ${doomed.length} dòng vào ${backupFile}`);

    for (const p of plans) {
      const done = await prisma.$transaction(async (tx) => {
        const deleted = await tx.timeline_tasks.deleteMany({ where: { wedding_id: p.id, task_code: { not: null }, task_type: 'Frame', order_id: null } });
        const created = await tx.timeline_tasks.createMany({ data: p.rows });
        if (deleted.count !== p.del || created.count !== p.rows.length) throw new Error(`Lệch số dòng ở ${p.id}: xóa ${deleted.count}/${p.del}, tạo ${created.count}/${p.rows.length}`);
        return { deleted: deleted.count, created: created.count };
      });
      console.log(`đã dựng lại ${p.id}: xóa ${done.deleted} (dự kiến ${p.del}), tạo ${done.created} (dự kiến ${p.rows.length})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
