/*
 * Nạp việc mẫu theo gói (prisma/seed-data/package_tasks_seed.json) vào package_tasks.
 *
 *   npm run seed:package-tasks             DRY-RUN (mặc định): chỉ ĐỌC CSDL, in báo cáo, không ghi gì
 *   npm run seed:package-tasks -- --apply  ghi thật; mỗi gói một transaction
 *
 * Ghép gói trong file với service_packages bằng tên NCC (vendor_profiles.business_name) + tên gói, so sánh sau khi chuẩn hóa
 * (Unicode NFC, gộp khoảng trắng, bỏ hoa thường). Khớp nhiều gói thì đối chiếu thêm giá; vẫn nhiều thì báo và bỏ qua.
 * Gói đã có ít nhất một việc chưa xóa thì BỎ QUA (không ghi đè việc NCC đã nhập).
 * Chỉ ĐỌC service_packages, vendor_profiles, package_tasks; chỉ INSERT vào package_tasks. Không UPDATE / DELETE bảng nào.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { parseTasks } from '../src/modules/vendors/package-tasks';

const apply = process.argv.includes('--apply');
const fileArg = process.argv.find((a) => a.startsWith('--file='))?.slice(7);
const FILE = path.resolve(fileArg ?? 'prisma/seed-data/package_tasks_seed.json');

interface SeedTask {
  sort: number;
  title: string;
  owner: string;
  offsetDays: number;
}
interface SeedPackage {
  category: string;
  vendor: string;
  package: string;
  price: number;
  tasks: SeedTask[];
}

const norm = (s: string | null | undefined) => (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
const label = (p: SeedPackage) => `[${p.category}] ${p.vendor} — ${p.package}`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  const seed = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { packages: SeedPackage[] };
  const totalSeedTasks = seed.packages.reduce((n, p) => n + p.tasks.length, 0);
  console.log(`${apply ? 'APPLY (ghi thật)' : 'DRY-RUN (không ghi gì)'} — file ${path.relative(process.cwd(), FILE)}: ${seed.packages.length} gói, ${totalSeedTasks} việc`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    const rows = await prisma.service_packages.findMany({ select: { id: true, name: true, price: true, vendor_profiles: { select: { business_name: true } } } });
    const byKey = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${norm(r.vendor_profiles?.business_name)}|${norm(r.name)}`;
      byKey.set(key, [...(byKey.get(key) ?? []), r]);
    }
    const counts = await prisma.package_tasks.groupBy({ by: ['package_id'], where: { deleted_at: null }, _count: { _all: true } });
    const hasTasks = new Map(counts.map((c) => [c.package_id, c._count._all]));

    const unmatched: SeedPackage[] = [];
    const ambiguous: { p: SeedPackage; ids: string[] }[] = [];
    const skipped: { p: SeedPackage; id: string; n: number }[] = [];
    const invalid: { p: SeedPackage; why: string }[] = [];
    const dupInFile: SeedPackage[] = [];
    const todo: { p: SeedPackage; id: string; tasks: ReturnType<typeof parseTasks>['tasks'] }[] = [];
    const used = new Set<string>();

    for (const p of seed.packages) {
      const found = byKey.get(`${norm(p.vendor)}|${norm(p.package)}`) ?? [];
      if (!found.length) {
        unmatched.push(p);
        continue;
      }
      let pick = found;
      if (found.length > 1) pick = found.filter((f) => Number(f.price) === Number(p.price));
      if (pick.length !== 1) {
        ambiguous.push({ p, ids: found.map((f) => f.id) });
        continue;
      }
      const id = pick[0].id;
      if (used.has(id)) {
        dupInFile.push(p);
        continue;
      }
      used.add(id);
      const existing = hasTasks.get(id) ?? 0;
      if (existing > 0) {
        skipped.push({ p, id, n: existing });
        continue;
      }
      const parsed = parseTasks([...p.tasks].sort((a, b) => a.sort - b.sort).map((t) => ({ title: t.title, note: null, owner: t.owner, offsetDays: t.offsetDays })));
      if (parsed.errors.length) {
        invalid.push({ p, why: parsed.errors.map((e) => `dòng ${e.index + 1}: ${e.message}`).join('; ') });
        continue;
      }
      todo.push({ p, id, tasks: parsed.tasks });
    }

    const toInsert = todo.reduce((n, t) => n + t.tasks.length, 0);
    const list = <T>(title: string, items: T[], fmt: (x: T) => string) => {
      console.log(`\n${title}: ${items.length}`);
      for (const x of items) console.log(`  - ${fmt(x)}`);
    };
    console.log(`\nKhớp gói: ${todo.length + skipped.length} / ${seed.packages.length} (không khớp ${unmatched.length}, khớp nhiều ${ambiguous.length}, trùng trong file ${dupInFile.length})`);
    list('Không khớp (vendor + gói)', unmatched, label);
    list('Khớp nhiều gói (bỏ qua)', ambiguous, ({ p, ids }) => `${label(p)} → ${ids.length} gói`);
    list('Trùng trong file (bỏ qua bản sau)', dupInFile, label);
    list('Bỏ qua vì gói đã có việc', skipped, ({ p, n }) => `${label(p)} (đã có ${n} việc)`);
    list('Bỏ qua vì dữ liệu việc không hợp lệ', invalid, ({ p, why }) => `${label(p)}: ${why}`);
    console.log(`\nSẽ thêm: ${toInsert} việc vào ${todo.length} gói`);

    // 3 gói mẫu, ưu tiên khác lĩnh vực
    const sample: typeof todo = [];
    for (const t of todo) if (sample.length < 3 && !sample.some((s) => s.p.category === t.p.category)) sample.push(t);
    for (const t of todo) if (sample.length < 3 && !sample.includes(t)) sample.push(t);
    for (const t of sample) {
      console.log(`\nMẫu: ${label(t.p)} — ${t.tasks.length} việc (gói ${t.id})`);
      t.tasks.forEach((x, i) => console.log(`  ${String(i).padStart(2)}  ${String(x.offsetDays).padStart(4)}  ${x.owner.padEnd(8)}  ${x.title}`));
    }

    if (!apply) {
      console.log('\nDry-run xong, chưa ghi gì. Thêm --apply để ghi thật.');
      return;
    }

    let done = 0;
    let inserted = 0;
    const failed: string[] = [];
    for (const t of todo) {
      try {
        const n = await prisma.$transaction(async (tx) => {
          // Kiểm lại trong transaction: NCC vừa nhập việc cho gói này thì không ghi đè
          if ((await tx.package_tasks.count({ where: { package_id: t.id, deleted_at: null } })) > 0) return 0;
          const r = await tx.package_tasks.createMany({
            data: t.tasks.map((x, i) => ({ package_id: t.id, sort_order: i, title: x.title, note: null, owner: x.owner, offset_days: x.offsetDays })),
          });
          return r.count;
        });
        if (n > 0) done++;
        inserted += n;
      } catch (e) {
        failed.push(`${label(t.p)}: ${(e as Error).message}`);
      }
    }
    console.log(`\nTổng kết: đã thêm ${inserted} việc vào ${done}/${todo.length} gói; lỗi ${failed.length}`);
    for (const f of failed) console.log(`  ! ${f}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
