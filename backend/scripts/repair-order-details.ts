/*
 * Sinh bù việc chi tiết cho các đơn đã cọc đang thiếu việc: việc lấy từ package_tasks của gói gắn với đơn (xem orderTaskRows trong
 * src/modules/weddings/timeline-rows.ts), hạn tính từ D = ngày cọc, E = ngày thực hiện của đơn. KHÔNG chạy trong đợt này.
 *
 *   npm run timelines:repair                                  DRY-RUN toàn bộ đơn Deposited (mặc định): chỉ đọc CSDL, in từng đơn sẽ tạo gì
 *   npm run timelines:repair -- --orders=DH26110002           DRY-RUN chỉ các đơn liệt kê (cách nhau bằng dấu phẩy)
 *   npm run timelines:repair -- --orders=MÃ1,MÃ2 --apply      ghi thật cho đúng các đơn đó; chỉ INSERT vào timeline_tasks
 *
 * --apply BẮT BUỘC đi kèm --orders (không có thì từ chối chạy): không ghi hàng loạt lên mọi đơn.
 * Với mỗi đơn Deposited: thêm các việc 'PKG:<id>' và 'PAY:<orderId>' CHƯA có (theo task_code). Không xóa, không sửa dòng nào.
 * Đơn đã đủ việc thì không có gì để làm (chạy lại được nhiều lần).
 * Đơn đã có việc chi tiết mẫu cũ (task_code không phải 'PKG:' / 'PAY:', ví dụ ATTIRE_*, VENUE_*, *_PAY) bị BỎ QUA, kể cả khi có gói:
 * thêm 'PAY:' sẽ trùng việc thanh toán cũ. Bảng "bỏ qua" ở cuối liệt kê các đơn đó.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { packagesOfOrder } from '../src/modules/weddings/package-task-meta';
import { orderTaskRows, ORD_PREFIX, PAY_PREFIX, PKG_PREFIX, type PackageTaskRef, type TaskRow } from '../src/modules/weddings/timeline-rows';

const apply = process.argv.includes('--apply');
const ordersArg = process.argv.find((a) => a === '--orders' || a.startsWith('--orders='));
const only = ordersArg === undefined ? null : [...new Set((ordersArg.split('=')[1] ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
if (only && !only.length) {
  console.error('--orders cần ít nhất một mã đơn, ví dụ --orders=DH26110002,DH26100037');
  process.exit(1);
}
if (apply && !only) {
  console.error('Từ chối chạy: --apply phải đi kèm --orders=MÃ1,MÃ2 (chỉ ghi cho đúng các đơn được liệt kê). Chạy không có --apply để xem dry-run.');
  process.exit(1);
}
/** Việc chi tiết của đơn sinh từ mẫu cũ (mọi task_code gắn đơn không phải của gói / thanh toán mới) */
const isLegacyCode = (code: string) => !code.startsWith(PKG_PREFIX) && !code.startsWith(PAY_PREFIX) && !code.startsWith(ORD_PREFIX);
const vnYmd = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    const orders = await prisma.orders.findMany({
      where: { status: 'Deposited', wedding_id: { not: null }, event_date: { not: null }, ...(only ? { order_code: { in: only } } : {}) },
      select: {
        id: true,
        order_code: true,
        wedding_id: true,
        event_date: true,
        package_id: true,
        order_items: { select: { package_id: true } },
        payments: { select: { paid_date: true } },
        vendor_profiles: { select: { business_name: true, category_id: true } },
      },
    });

    const table: Record<string, unknown>[] = [];
    const skipped: Record<string, unknown>[] = [];
    const plans: { orderId: string; rows: TaskRow[] }[] = [];
    const today = vnYmd(new Date());
    if (only) {
      const found = new Set(orders.map((o) => (o.order_code ?? '').toUpperCase()));
      const missing = only.filter((c) => !found.has(c));
      if (missing.length) console.log(`Không có đơn Deposited (đủ ngày cưới, ngày thực hiện) với mã: ${missing.join(', ')}`);
    }
    for (const o of orders) {
      const packageIds = packagesOfOrder(o);
      const found = packageIds.length ? await prisma.package_tasks.findMany({ where: { package_id: { in: packageIds }, deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] }) : [];
      const tasks: PackageTaskRef[] = packageIds
        .flatMap((pid) => found.filter((t) => t.package_id === pid))
        .map((t) => ({ id: t.id, title: t.title, note: t.note, owner: t.owner as PackageTaskRef['owner'], offsetDays: t.offset_days }));
      const existing = new Set((await prisma.timeline_tasks.findMany({ where: { order_id: o.id, task_code: { not: null } }, select: { task_code: true } })).map((t) => t.task_code!));
      const legacy = [...existing].filter(isLegacyCode);
      if (legacy.length) {
        skipped.push({ 'đơn': o.order_code, 'lý do': 'đã có việc chi tiết mẫu cũ', 'số việc cũ': legacy.length, 'ví dụ': legacy.slice(0, 3).join(', ') });
        continue;
      }
      const { rows, vendorProcessMissing } = orderTaskRows({
        weddingId: o.wedding_id!,
        orderId: o.id,
        categoryId: o.vendor_profiles?.category_id ?? null,
        vendorName: o.vendor_profiles?.business_name ?? '',
        ctx: { today, event: ymd(o.event_date!), deposit: o.payments?.paid_date ? vnYmd(o.payments.paid_date) : today },
        tasks,
        existingCodes: existing,
      });
      if (!rows.length) continue;
      plans.push({ orderId: o.id, rows });
      table.push({ 'đơn': o.order_code, 'gói': packageIds.length, 'việc gói': tasks.length, 'sẽ tạo': rows.length, 'thiếu quy trình NCC': vendorProcessMissing ? 'có' : '' });
    }

    console.log(apply ? '== CHẠY THẬT (--apply) ==' : '== DRY-RUN: không ghi gì vào CSDL ==');
    if (!table.length) console.log('Không có đơn nào thiếu việc chi tiết.');
    else console.table(table);
    if (skipped.length) {
      console.log(`Bỏ qua ${skipped.length} đơn đã có việc chi tiết mẫu cũ (không thêm việc PAY trùng):`);
      console.table(skipped);
    }
    if (!apply || !plans.length) return;

    for (const p of plans) {
      const created = await prisma.timeline_tasks.createMany({ data: p.rows, skipDuplicates: true });
      console.log(`đã tạo ${created.count}/${p.rows.length} việc cho đơn ${p.orderId}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
