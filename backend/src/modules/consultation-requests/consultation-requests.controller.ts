import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { fail } from '../admin/admin-common';
import { ConsultationRequestsService, CreateConsultationDto } from './consultation-requests.service';

// Mặc định 3 lần/giờ/IP; đặt CONSULTATION_RATE_LIMIT trong .env nếu cần nới khi thử nghiệm
const LIMIT = Number(process.env.CONSULTATION_RATE_LIMIT) || 3;
const WINDOW_MS = 60 * 60_000;
/** Số lần gửi theo IP trong 1 giờ gần nhất (lưu trong bộ nhớ, mất khi khởi động lại backend). */
const hits = new Map<string, number[]>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return fail('TOO_MANY_REQUESTS', 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.', 429);
  }
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
}

@Controller('consultation-requests')
export class ConsultationRequestsController {
  constructor(private readonly service: ConsultationRequestsService) {}

  // POST /api/consultation-requests (công khai, tối đa 3 lần mỗi giờ cho mỗi IP)
  @Post()
  create(@Body() body: CreateConsultationDto, @Req() req: Request) {
    checkRateLimit(req.ip ?? 'unknown');
    return this.service.create(body);
  }
}
