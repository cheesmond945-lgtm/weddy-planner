/*
 * Khôi phục timeline_tasks từ bản sao lưu do rebuild-timelines.ts xuất (scripts/backup/timeline_tasks_<ngày>.json).
 *
 *   npm run timelines:restore -- scripts/backup/timeline_tasks_2026-10-29.json            DRY-RUN: chỉ đếm
 *   npm run timelines:restore -- scripts/backup/timeline_tasks_2026-10-29.json --apply   ghi thật
 *
 * Với từng đám cưới có trong file (một transaction mỗi đám cưới): xóa mọi việc có task_code (việc sinh từ mẫu, gồm cả việc mới
 * do rebuild tạo), rồi chèn lại đúng các dòng trong file, giữ nguyên id. Việc khách tự thêm (task_code rỗng) không bị đụng.
 * CHƯA CHẠY: chỉ dùng khi cần quay lại timeline cũ.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const apply = process.argv.includes('--apply');
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));

async function main() {
  if (!file) throw new Error('Thiếu đường dẫn file sao lưu.');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  const raw: Record<string, unknown>[] = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const dates = ['scheduled_date', 'completed_date', 'created_date'];
  const rows = raw.map((r) => {
    const o = { ...r };
    for (const k of dates) if (typeof o[k] === 'string') o[k] = new Date(o[k] as string);
    return o as { id: string; wedding_id: string };
  });
  const byWedding = new Map<string, typeof rows>();
  for (const r of rows) byWedding.set(r.wedding_id, [...(byWedding.get(r.wedding_id) ?? []), r]);

  console.log(`${apply ? '== KHÔI PHỤC THẬT ==' : '== DRY-RUN =='}: ${rows.length} dòng, ${byWedding.size} đám cưới`);
  if (!apply) {
    console.log('Thêm --apply để ghi thật.');
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    for (const [weddingId, list] of byWedding) {
      const done = await prisma.$transaction(async (tx) => {
        const deleted = await tx.timeline_tasks.deleteMany({ where: { wedding_id: weddingId, task_code: { not: null } } });
        const created = await tx.timeline_tasks.createMany({ data: list as never });
        return { deleted: deleted.count, created: created.count };
      });
      console.log(`đã khôi phục ${weddingId}: xóa ${done.deleted}, chèn lại ${done.created}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
