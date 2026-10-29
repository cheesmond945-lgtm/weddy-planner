/*
 * Sinh bù việc chi tiết cho các đơn đã cọc đang thiếu việc (xem depositDetailPlan trong src/modules/weddings/timeline-rows.ts).
 *
 *   npm run timelines:repair             DRY-RUN (mặc định): chỉ đọc CSDL, in từng đơn sẽ xóa / tạo gì
 *   npm run timelines:repair -- --apply  ghi thật (sao lưu dòng sẽ xóa trước); mỗi đám cưới một transaction
 *
 * Mỗi hạng mục của một đám cưới chỉ MỘT đơn Deposited giữ việc chi tiết: đơn có ngày cọc MỚI NHẤT. Với đơn đó:
 *   - XÓA việc chi tiết CHƯA xong gắn với đơn khác cùng hạng mục (thay bằng việc của đơn này);
 *   - CHÈN việc còn thiếu (mã chưa có), hạn tính từ D = ngày cọc, E = ngày thực hiện của đơn;
 *   - việc đã xong, việc khung, việc khách tự thêm và việc của hạng mục khác KHÔNG bị đụng.
 * Đơn đã đúng rồi thì không có gì để làm (chạy lại được nhiều lần). Chỉ ghi timeline_tasks.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { depositDetailPlan, type TaskRow } from '../src/modules/weddings/timeline-rows';
import { defaultAlbumDate } from '../src/modules/weddings/timeline-schedule';
import { SERVICE_BY_CATEGORY_NAME, TIMELINE_TEMPLATES, type ServiceKey } from '../src/modules/weddings/timeline-templates';

const apply = process.argv.includes('--apply');
const vnYmd = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    const cats = await prisma.service_categories.findMany({ select: { id: true, name: true } });
    const keyOf = new Map(cats.flatMap((c) => (c.name && SERVICE_BY_CATEGORY_NAME[c.name] ? [[c.id, SERVICE_BY_CATEGORY_NAME[c.name]] as const] : [])));
    const weddings = await prisma.weddings.findMany({
      orderBy: { created_date: 'asc' },
      where: { wedding_date: { not: null } },
      include: {
        users: { select: { full_name: true, username: true } },
        orders: { where: { status: 'Deposited' }, include: { payments: true, vendor_profiles: { select: { category_id: true } } } },
      },
    });

    const table: Record<string, unknown>[] = [];
    const plans: { weddingId: string; orderId: string; deleteIds: string[]; rows: TaskRow[] }[] = [];

    for (const w of weddings) {
      if (!w.orders.length) continue;
      const tasks = await prisma.timeline_tasks.findMany({ where: { wedding_id: w.id, task_code: { not: null } }, select: { id: true, task_code: true, status: true, order_id: true, scheduled_date: true } });
      const paidAt = (o: (typeof w.orders)[number]) => o.payments?.paid_date ?? o.created_date ?? new Date(0);
      const owner = new Map<ServiceKey, (typeof w.orders)[number]>();
      for (const o of [...w.orders].sort((a, b) => paidAt(b).getTime() - paidAt(a).getTime())) {
        const key = o.vendor_profiles?.category_id ? keyOf.get(o.vendor_profiles.category_id) : undefined;
        if (key && !owner.has(key)) owner.set(key, o);
      }
      const W = ymd(w.wedding_date!);
      const shoot = tasks.find((t) => t.task_code === 'PHOTO_ALBUM_SHOOT')?.scheduled_date;
      const chup = owner.get('chup-anh');
      const albumDate = shoot ? ymd(shoot) : chup ? defaultAlbumDate(vnYmd(paidAt(chup)), W) : undefined;
      let current = tasks.map((t) => ({ id: t.id, code: t.task_code!, status: t.status, orderId: t.order_id }));

      for (const [key, o] of owner) {
        const categoryId = o.vendor_profiles!.category_id!;
        const deposit = vnYmd(paidAt(o));
        const plan = depositDetailPlan(TIMELINE_TEMPLATES, {
          weddingId: w.id,
          orderId: o.id,
          service: { key, categoryId },
          ctx: { today: deposit, wedding: W, event: o.event_date ? ymd(o.event_date) : W, deposit, albumDate },
          existing: current,
        });
        if (!plan.deleteIds.length && !plan.rows.length) continue;
        plans.push({ weddingId: w.id, orderId: o.id, ...plan });
        const gone = new Set(plan.deleteIds);
        current = [...current.filter((t) => !gone.has(t.id)), ...plan.rows.map((r, i) => ({ id: `new${i}`, code: r.task_code, status: r.status, orderId: r.order_id }))];
        table.push({
          khách: w.users?.full_name || w.users?.username || '',
          'đơn': o.order_code,
          'hạng mục': key,
          'ngày cọc (D)': deposit,
          'thực hiện (E)': o.event_date ? ymd(o.event_date) : '',
          'xóa (chưa xong, đơn khác)': plan.deleteIds.length,
          'tạo': plan.rows.length,
          'mã sẽ tạo': plan.rows.map((r) => `${r.task_code}@${ymd(r.scheduled_date)}`).join(' '),
        });
      }
    }

    console.log(apply ? '== CHẠY THẬT (--apply) ==' : '== DRY-RUN: không ghi gì vào CSDL ==');
    if (!table.length) console.log('Không có đơn nào thiếu việc chi tiết.');
    else console.table(table);
    if (!apply || !plans.length) return;

    const ids = plans.flatMap((p) => p.deleteIds);
    const backupFile = path.join(__dirname, '..', '..', '..', '..', 'scripts', 'backup', `timeline_tasks_repair_${vnYmd(new Date())}.json`);
    if (fs.existsSync(backupFile)) throw new Error(`Đã có bản sao lưu ${backupFile}, xóa hoặc đổi tên rồi chạy lại.`);
    const doomed = ids.length ? await prisma.timeline_tasks.findMany({ where: { id: { in: ids } } }) : [];
    if (doomed.length !== ids.length) throw new Error(`Số dòng sao lưu (${doomed.length}) khác số dòng sẽ xóa (${ids.length}), dừng.`);
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.writeFileSync(backupFile, JSON.stringify(doomed, null, 2), 'utf8');
    console.log(`Đã sao lưu ${doomed.length} dòng vào ${backupFile}`);

    for (const p of plans) {
      const done = await prisma.$transaction(async (tx) => {
        const deleted = p.deleteIds.length ? await tx.timeline_tasks.deleteMany({ where: { id: { in: p.deleteIds } } }) : { count: 0 };
        const created = p.rows.length ? await tx.timeline_tasks.createManyAndReturn({ data: p.rows, select: { id: true, task_code: true } }) : [];
        if (deleted.count !== p.deleteIds.length) throw new Error(`Lệch số dòng xóa ở đơn ${p.orderId}`);
        return { deleted: deleted.count, created };
      });
      console.log(`đơn ${p.orderId}: xóa ${done.deleted}, tạo ${done.created.length}`);
      for (const c of done.created) console.log(`   + ${c.id} ${c.task_code}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
