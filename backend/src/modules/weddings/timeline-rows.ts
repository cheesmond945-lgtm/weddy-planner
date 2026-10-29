/*
 * Chuyển kế hoạch ngày (timeline-schedule.ts) thành dòng timeline_tasks. Hàm thuần, không đụng CSDL:
 * dùng chung cho hook (timeline-hooks.ts) và script dựng lại timeline (scripts/rebuild-timelines.ts).
 */
import { planDetails, planFrame, type DetailContext } from './timeline-schedule.ts';
import { isFrameKind, type ServiceKey, type TimelineTemplate } from './timeline-templates.ts';

export interface ServiceRef {
  key: ServiceKey;
  categoryId: string;
}

export interface TaskRow {
  wedding_id: string;
  category_id: string | null;
  order_id: string | null;
  title: string;
  scheduled_date: Date;
  status: 'Todo' | 'Done';
  completed_date?: Date | null;
  task_type: 'Frame' | 'Detail';
  task_code: string;
  display_order: number;
}

const asDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

/** Việc khung: Tự làm của "Chung" và Tự làm / Chọn NCC / Mốc chốt của các hạng mục đã chọn, hạn tính từ ngày cưới. */
export function frameRows(templates: readonly TimelineTemplate[], input: { weddingId: string; wedding: string; today: string; services: readonly ServiceRef[] }): TaskRow[] {
  const plan = planFrame(templates, { wedding: input.wedding, today: input.today, services: input.services.map((s) => s.key) });
  const byCode = new Map(templates.map((t) => [t.code, t]));
  return plan.tasks.map((p) => {
    const t = byCode.get(p.code)!;
    return {
      wedding_id: input.weddingId,
      category_id: t.service ? (input.services.find((s) => s.key === t.service)?.categoryId ?? null) : null,
      order_id: null,
      title: t.title,
      scheduled_date: asDate(p.date),
      status: 'Todo' as const,
      task_type: isFrameKind(t.kind) ? ('Frame' as const) : ('Detail' as const),
      task_code: t.code,
      display_order: t.order,
    };
  });
}

/** Việc chi tiết của một dịch vụ vừa đặt cọc, gắn đơn; bỏ qua mã đã có trong timeline (không tính lại, không dời việc cũ). */
export function detailRows(
  templates: readonly TimelineTemplate[],
  input: { weddingId: string; orderId: string; service: ServiceRef; ctx: DetailContext; existing: ReadonlySet<string> },
): TaskRow[] {
  const byCode = new Map(templates.map((t) => [t.code, t]));
  return planDetails(templates, input.service.key, input.ctx)
    .tasks.filter((p) => !input.existing.has(p.code))
    .map((p) => {
      const t = byCode.get(p.code)!;
      return {
        wedding_id: input.weddingId,
        category_id: input.service.categoryId,
        order_id: input.orderId,
        title: t.title,
        scheduled_date: asDate(p.date),
        status: 'Todo' as const,
        task_type: 'Detail' as const,
        task_code: t.code,
        display_order: t.order,
      };
    });
}

export interface ExistingDetail {
  id: string;
  code: string;
  status: string | null;
  orderId: string | null;
}

/**
 * Việc chi tiết cho một đơn vừa đặt cọc (hoặc đơn còn lại sau khi đơn khác bị hủy). timeline_tasks chỉ cho một việc mỗi mã trong một
 * đám cưới, nên khi cùng hạng mục đã có đơn khác giữ các việc này thì đơn MỚI NHẤT giữ việc: việc chi tiết CHƯA xong gắn với đơn khác
 * bị thay bằng việc của đơn này (hạn tính lại từ D, E của đơn này); việc đã xong giữ nguyên (và chặn mã đó, không sinh lại).
 * Hàm thuần, không đụng CSDL: trả các id cần xóa và các dòng cần chèn. Gọi lại nhiều lần cho cùng một đơn thì không còn gì để làm.
 */
export function depositDetailPlan(
  templates: readonly TimelineTemplate[],
  input: { weddingId: string; orderId: string; service: ServiceRef; ctx: DetailContext; existing: readonly ExistingDetail[] },
): { deleteIds: string[]; rows: TaskRow[] } {
  const mine = new Set(templates.filter((t) => t.service === input.service.key && !isFrameKind(t.kind)).map((t) => t.code));
  const stale = input.existing.filter((t) => mine.has(t.code) && t.orderId !== null && t.orderId !== input.orderId && t.status !== 'Done');
  const gone = new Set(stale.map((t) => t.id));
  const keep = new Set(input.existing.filter((t) => !gone.has(t.id)).map((t) => t.code));
  return { deleteIds: [...gone], rows: detailRows(templates, { weddingId: input.weddingId, orderId: input.orderId, service: input.service, ctx: input.ctx, existing: keep }) };
}

export interface CancelInput {
  /** Đơn bị hủy */
  orderId: string;
  /** Việc chi tiết đang gắn với đơn bị hủy (kể cả việc đã xong) */
  details: readonly { id: string }[];
  /** Đơn khác cùng hạng mục của khách: Deposited / Completed */
  others: readonly { id: string; status: string; paidAt: number }[];
}

/**
 * Khi đơn đã cọc bị hủy: gỡ MỌI việc chi tiết của đơn đó (kể cả việc đã xong). Còn đơn khác cùng hạng mục đã cọc / hoàn thành thì Mốc chốt
 * vẫn xong, và đơn Deposited cọc mới nhất (nếu có) nhận lại việc chi tiết; không còn thì Mốc chốt về Todo (nhóm quay lại trạng thái khóa).
 * Hàm thuần, không đụng CSDL.
 */
export function cancelPlan(input: CancelInput): { deleteIds: string[]; handOverTo: string | null; reopenBook: boolean } {
  const next = input.others.filter((o) => o.status === 'Deposited').sort((a, b) => b.paidAt - a.paidAt)[0];
  return { deleteIds: input.details.map((d) => d.id), handOverTo: next?.id ?? null, reopenBook: input.others.length === 0 };
}
