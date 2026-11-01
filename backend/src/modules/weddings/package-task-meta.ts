import type { PrismaService } from '../../prisma/prisma.service';
import type { TaskOwner } from './task-owner.ts';
import { pkgTaskIdOf } from './timeline-rows.ts';

/** Gói của đơn: sảnh của đơn (orders.package_id, chỉ Trung tâm tổ chức sự kiện) hợp với gói của từng dòng hạng mục (order_items.package_id); bỏ null, bỏ trùng. */
export function packagesOfOrder(order: { package_id?: string | null; order_items?: readonly { package_id?: string | null }[] }): string[] {
  const out: string[] = [];
  for (const id of [order.package_id, ...(order.order_items ?? []).map((i) => i.package_id)]) if (id && !out.includes(id)) out.push(id);
  return out;
}

export interface PackageTaskMeta {
  owner: TaskOwner;
  offsetDays: number;
}

/**
 * Chủ và mốc của các việc gói được nhắc tới trong `codes` (task_code 'PKG:<id>'), nạp MỘT query theo lô, kể cả việc đã xóa mềm
 * (NCC xóa việc khỏi gói sau khi đơn đã cọc thì việc của đơn vẫn còn). Map: package_tasks.id -> meta.
 */
export async function loadPackageMeta(prisma: Pick<PrismaService, 'package_tasks'>, codes: Iterable<string | null | undefined>): Promise<Map<string, PackageTaskMeta>> {
  const ids = [...new Set([...codes].flatMap((c) => pkgTaskIdOf(c) ?? []))];
  if (!ids.length) return new Map();
  const rows = await prisma.package_tasks.findMany({ where: { id: { in: ids } }, select: { id: true, owner: true, offset_days: true } });
  return new Map(rows.map((r) => [r.id, { owner: r.owner as TaskOwner, offsetDays: r.offset_days }]));
}

/** Chỉ phần owner của loadPackageMeta, để truyền cho ownerOf(code, owners). */
export const ownersFrom = (meta: ReadonlyMap<string, PackageTaskMeta>): Map<string, TaskOwner> => new Map([...meta].map(([id, m]) => [id, m.owner]));
