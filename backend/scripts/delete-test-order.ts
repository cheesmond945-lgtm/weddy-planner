/*
 * Xóa HẲN một đơn thử (và mọi dòng gắn với đơn) khỏi CSDL.
 *
 *   npm run delete:test-order -- --order=DH26110001            DRY-RUN (mặc định): chỉ đọc, in từng bảng sẽ xóa bao nhiêu dòng
 *   npm run delete:test-order -- --order=DH26110001 --apply    xóa thật, tất cả trong MỘT transaction (lỗi là rollback toàn bộ)
 *
 * Bắt buộc --order=MÃ_ĐƠN, đúng một đơn. Các bảng tham chiếu orders (theo schema.prisma) và cách script xử lý, xóa con trước cha:
 *   notifications (reference_id = đơn / việc / yêu cầu chỉnh sửa / hóa đơn / thanh toán của đơn; không có khóa ngoại)  -> xóa
 *   reviews         (order_item_id, FK CASCADE từ order_items)                                                         -> xóa
 *   task_confirmations (task_id, FK CASCADE từ timeline_tasks)                                                         -> xóa
 *   timeline_tasks  (order_id, FK NO ACTION)  việc chi tiết của đơn                                                    -> xóa
 *   order_revision_changes (revision_id, FK CASCADE từ order_revisions)                                                -> xóa
 *   order_revisions (order_id, FK CASCADE)                                                                             -> xóa
 *   messages        (order_id, FK NO ACTION)  chỉ tin nhắn gắn với đơn (thẻ Order, DepositReceipt, FinalInvoice, tin hệ thống) -> xóa
 *   invoices        (order_id, FK NO ACTION)                                                                           -> xóa
 *   payments        (order_id, FK NO ACTION)                                                                           -> xóa
 *   order_items     (order_id, FK CASCADE)                                                                             -> xóa
 *   commissions     (order_id, FK NO ACTION)  hoa hồng đã ghi vào bảng kê: KHÔNG xóa được an toàn -> script từ chối --apply nếu có
 *   orders                                                                                                             -> xóa
 * Lịch bận sảnh không có bảng riêng cho đơn (suy từ orders), nên hết bận khi đơn bị xóa.
 * KHÔNG đụng: users, vendor_profiles, weddings, conversations (chỉ xóa tin nhắn của đơn), service_packages, việc khung.
 * Sau khi xóa: khách không còn đơn Deposited / Completed nào cùng hạng mục thì Mốc chốt *_BOOK của hạng mục về Todo (như luồng hủy đơn).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const apply = process.argv.includes('--apply');
const orderCode = process.argv.find((a) => a.startsWith('--order='))?.slice('--order='.length).trim() ?? '';
const SAMPLE = 3;

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');
const clip = (s: string | null | undefined, n = 70) => ((s ?? '').length > n ? `${(s ?? '').slice(0, n - 1)}…` : (s ?? ''));

interface Plan {
  table: string;
  fk: string;
  action: string;
  count: number;
  samples: string[];
}

async function main() {
  if (!/^[A-Za-z0-9_-]+$/.test(orderCode)) {
    throw new Error('Thiếu hoặc sai --order=MÃ_ĐƠN (bắt buộc, đúng một đơn). Ví dụ: --order=DH26110001');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    const found = await prisma.orders.findMany({
      where: { order_code: orderCode },
      include: {
        payments: true,
        order_items: true,
        vendor_profiles: { select: { id: true, business_name: true, category_id: true, service_categories: { select: { name: true } } } },
        weddings: { select: { id: true, wedding_date: true, users: { select: { full_name: true, username: true } } } },
      },
    });
    if (found.length !== 1) throw new Error(`Mã đơn ${orderCode}: tìm thấy ${found.length} đơn, cần đúng 1. Dừng, chưa làm gì.`);
    const o = found[0];

    console.log(apply ? '== CHẠY THẬT (--apply) ==' : '== DRY-RUN: không ghi gì vào CSDL ==');
    console.log('\nĐƠN');
    console.table([
      {
        'mã đơn': o.order_code,
        id: o.id,
        'khách (đơn)': o.customer_name,
        'tài khoản khách': o.weddings?.users?.full_name || o.weddings?.users?.username || '',
        NCC: o.vendor_profiles?.business_name,
        'hạng mục': o.vendor_profiles?.service_categories?.name,
        'trạng thái': o.status,
        'ngày thực hiện': ymd(o.event_date),
        'tổng tiền': Number(o.total_amount),
        'tiền cọc': Number(o.deposit_amount),
        'thanh toán cọc': o.payments?.status ?? '(chưa có)',
        'ngày cọc': ymd(o.payments?.paid_date),
        'tạo lúc': ymd(o.created_date),
      },
    ]);

    const itemIds = o.order_items.map((i) => i.id);
    const [tasks, revisions, messages, invoices, commissions] = await Promise.all([
      prisma.timeline_tasks.findMany({ where: { order_id: o.id }, select: { id: true, title: true, status: true, task_code: true, scheduled_date: true }, orderBy: { scheduled_date: 'asc' } }),
      prisma.order_revisions.findMany({ where: { order_id: o.id }, select: { id: true, revision_type: true, status: true, created_date: true } }),
      prisma.messages.findMany({ where: { order_id: o.id }, select: { id: true, type: true, content: true, sent_date: true }, orderBy: { sent_date: 'asc' } }),
      prisma.invoices.findMany({ where: { order_id: o.id }, select: { id: true, invoice_code: true, type: true } }),
      prisma.commissions.findMany({ where: { order_id: o.id }, select: { id: true, amount: true, statement_id: true } }),
    ]);
    const taskIds = tasks.map((t) => t.id);
    const revisionIds = revisions.map((r) => r.id);
    const [confirmations, reviews, revisionChanges] = await Promise.all([
      taskIds.length ? prisma.task_confirmations.findMany({ where: { task_id: { in: taskIds } }, select: { task_id: true, confirmed_date: true } }) : [],
      itemIds.length ? prisma.reviews.findMany({ where: { order_item_id: { in: itemIds } }, select: { id: true, rating: true, content: true } }) : [],
      revisionIds.length ? prisma.order_revision_changes.findMany({ where: { revision_id: { in: revisionIds } }, select: { revision_id: true, change_type: true } }) : [],
    ]);
    const refIds = [o.id, ...taskIds, ...revisionIds, ...invoices.map((i) => i.id), ...(o.payments ? [o.payments.id] : [])];
    const notifications = await prisma.notifications.findMany({
      where: { reference_id: { in: refIds } },
      select: { id: true, type: true, title: true, reference_type: true, created_date: true },
      orderBy: { created_date: 'asc' },
    });

    const plan: Plan[] = [
      { table: 'notifications', fk: 'không có FK (reference_id)', action: 'xóa', count: notifications.length, samples: notifications.slice(0, SAMPLE).map((n) => `${n.type} · ${n.reference_type} · ${clip(n.title)}`) },
      { table: 'reviews', fk: 'CASCADE từ order_items', action: 'xóa', count: reviews.length, samples: reviews.slice(0, SAMPLE).map((r) => `${r.rating}★ ${clip(r.content)}`) },
      { table: 'task_confirmations', fk: 'CASCADE từ timeline_tasks', action: 'xóa', count: confirmations.length, samples: confirmations.slice(0, SAMPLE).map((c) => `việc ${c.task_id.slice(0, 8)} chốt ${ymd(c.confirmed_date)}`) },
      { table: 'timeline_tasks (order_id)', fk: 'NO ACTION', action: 'xóa', count: tasks.length, samples: tasks.slice(0, SAMPLE).map((t) => `${t.status} · ${ymd(t.scheduled_date)} · ${clip(t.title)}`) },
      { table: 'order_revision_changes', fk: 'CASCADE từ order_revisions', action: 'xóa', count: revisionChanges.length, samples: [] },
      { table: 'order_revisions', fk: 'CASCADE', action: 'xóa', count: revisions.length, samples: revisions.slice(0, SAMPLE).map((r) => `${r.revision_type} · ${r.status} · ${ymd(r.created_date)}`) },
      { table: 'messages (order_id)', fk: 'NO ACTION', action: 'xóa (chỉ tin của đơn)', count: messages.length, samples: messages.slice(0, SAMPLE).map((m) => `${m.type} · ${ymd(m.sent_date)} · ${clip(m.content)}`) },
      { table: 'invoices', fk: 'NO ACTION', action: 'xóa', count: invoices.length, samples: invoices.slice(0, SAMPLE).map((i) => `${i.invoice_code} · ${i.type}`) },
      { table: 'payments', fk: 'NO ACTION', action: 'xóa', count: o.payments ? 1 : 0, samples: o.payments ? [`${o.payments.status} · ${o.payments.transaction_code ?? 'chưa có mã giao dịch'}`] : [] },
      { table: 'order_items', fk: 'CASCADE', action: 'xóa', count: o.order_items.length, samples: o.order_items.slice(0, SAMPLE).map((i) => `${i.item_name} · ${i.quantity} ${i.unit} × ${Number(i.unit_price)}`) },
      { table: 'commissions', fk: 'NO ACTION', action: commissions.length ? 'CHẶN (không xóa)' : 'không có', count: commissions.length, samples: commissions.slice(0, SAMPLE).map((c) => `${Number(c.amount)} · bảng kê ${c.statement_id?.slice(0, 8)}`) },
      { table: 'orders', fk: '—', action: 'xóa', count: 1, samples: [o.order_code ?? ''] },
    ];

    console.log('\nCÁC BẢNG THAM CHIẾU ĐƠN (xóa con trước cha, theo thứ tự dưới đây)');
    console.table(plan.map((p) => ({ 'bảng': p.table, 'khóa ngoại': p.fk, 'xử lý': p.action, 'số dòng': p.count })));
    for (const p of plan.filter((x) => x.samples.length)) console.log(`  ${p.table}:\n${p.samples.map((s) => `    - ${s}`).join('\n')}`);

    // Timeline của đám cưới khách bị ảnh hưởng thế nào
    const category = o.vendor_profiles?.category_id ?? null;
    const [weddingTasks, others] = await Promise.all([
      o.wedding_id ? prisma.timeline_tasks.findMany({ where: { wedding_id: o.wedding_id }, select: { id: true, order_id: true, task_type: true, task_code: true, status: true, category_id: true, title: true } }) : Promise.resolve([] as { id: string; order_id: string | null; task_type: string | null; task_code: string | null; status: string | null; category_id: string | null; title: string | null }[]),
      o.wedding_id && category
        ? prisma.orders.findMany({ where: { wedding_id: o.wedding_id, id: { not: o.id }, status: { in: ['Deposited', 'Completed'] }, vendor_profiles: { category_id: category } }, select: { order_code: true, status: true } })
        : Promise.resolve([] as { order_code: string | null; status: string | null }[]),
    ]);
    const books = weddingTasks.filter((t) => t.task_type === 'Frame' && !!t.task_code?.endsWith('_BOOK') && t.category_id === category);
    const reopen = others.length === 0 && books.some((b) => b.status === 'Done');
    console.log('\nTIMELINE CỦA ĐÁM CƯỚI KHÁCH');
    console.table([
      {
        'tổng việc của đám cưới': weddingTasks.length,
        'việc gắn đơn này (sẽ xóa)': weddingTasks.filter((t) => t.order_id === o.id).length,
        'việc gắn đơn khác (giữ)': weddingTasks.filter((t) => t.order_id && t.order_id !== o.id).length,
        'việc khung + tự thêm (giữ)': weddingTasks.filter((t) => !t.order_id).length,
        'đơn Deposited/Completed khác cùng hạng mục': others.length,
      },
    ]);
    console.log(
      books.length
        ? reopen
          ? `  Mốc chốt: ${books.map((b) => `${b.task_code} (${b.status})`).join(', ')} -> về Todo (khách không còn đơn Deposited/Completed nào cùng hạng mục)`
          : `  Mốc chốt: ${books.map((b) => `${b.task_code} (${b.status})`).join(', ')} -> GIỮ NGUYÊN${others.length ? ` (còn đơn ${others.map((x) => `${x.order_code} ${x.status}`).join(', ')})` : ''}`
        : '  Mốc chốt của hạng mục: không có dòng nào trong timeline của đám cưới này, không đổi gì.',
    );
    console.log('  Không xóa: tài khoản khách và NCC, đám cưới, cuộc hội thoại (chỉ xóa tin nhắn của đơn), gói dịch vụ, việc khung.');

    if (commissions.length) {
      console.log('\n!! Đơn đã có hoa hồng ghi vào bảng kê: script KHÔNG xóa đơn này (xóa sẽ làm lệch bảng kê hoa hồng của NCC). Hãy báo người phụ trách.');
      if (apply) throw new Error('Đơn có hoa hồng, dừng, chưa xóa gì.');
    }
    if (!apply) {
      console.log('\nDry-run xong, chưa ghi gì. Thêm --apply để xóa thật.');
      return;
    }

    const done = await prisma.$transaction(
      async (tx) => {
        const counts: Record<string, number> = {};
        const del = async (name: string, expected: number, run: () => Promise<{ count: number }>) => {
          const r = await run();
          counts[name] = r.count;
          // Lệch với dry-run (có người vừa ghi thêm): rollback toàn bộ
          if (r.count !== expected) throw new Error(`Lệch số dòng ở ${name}: xóa ${r.count}, dự kiến ${expected}. Rollback.`);
        };
        await del('notifications', notifications.length, () => tx.notifications.deleteMany({ where: { id: { in: notifications.map((n) => n.id) } } }));
        await del('reviews', reviews.length, () => tx.reviews.deleteMany({ where: { id: { in: reviews.map((r) => r.id) } } }));
        await del('task_confirmations', confirmations.length, () => tx.task_confirmations.deleteMany({ where: { task_id: { in: taskIds } } }));
        await del('timeline_tasks', tasks.length, () => tx.timeline_tasks.deleteMany({ where: { order_id: o.id } }));
        await del('order_revision_changes', revisionChanges.length, () => tx.order_revision_changes.deleteMany({ where: { revision_id: { in: revisionIds } } }));
        await del('order_revisions', revisions.length, () => tx.order_revisions.deleteMany({ where: { order_id: o.id } }));
        await del('messages', messages.length, () => tx.messages.deleteMany({ where: { order_id: o.id } }));
        await del('invoices', invoices.length, () => tx.invoices.deleteMany({ where: { order_id: o.id } }));
        await del('payments', o.payments ? 1 : 0, () => tx.payments.deleteMany({ where: { order_id: o.id } }));
        await del('order_items', o.order_items.length, () => tx.order_items.deleteMany({ where: { order_id: o.id } }));
        await del('orders', 1, () => tx.orders.deleteMany({ where: { id: o.id } }));
        // Mốc chốt: khách không còn đơn Deposited / Completed nào cùng hạng mục thì mở lại (như luồng hủy đơn)
        if (o.wedding_id && category) {
          const remain = await tx.orders.count({ where: { wedding_id: o.wedding_id, status: { in: ['Deposited', 'Completed'] }, vendor_profiles: { category_id: category } } });
          if (remain === 0) {
            const r = await tx.timeline_tasks.updateMany({
              where: { wedding_id: o.wedding_id, category_id: category, task_type: 'Frame', task_code: { endsWith: '_BOOK' }, status: 'Done' },
              data: { status: 'Todo', completed_date: null },
            });
            counts['Mốc chốt mở lại'] = r.count;
          }
        }
        return counts;
      },
      { timeout: 60_000 },
    );
    console.log('\nĐÃ XÓA đơn', orderCode);
    console.table(Object.entries(done).map(([bảng, dòng]) => ({ 'bảng': bảng, 'số dòng': dòng })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
