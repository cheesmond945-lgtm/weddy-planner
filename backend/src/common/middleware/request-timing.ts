import type { NextFunction, Request, Response } from 'express';

/**
 * Ghi thời gian xử lý từng API (ms) ra console, chỉ dùng ở môi trường dev (main.ts không gắn khi NODE_ENV = production).
 * Ví dụ: [api] PATCH /api/vendors/me/orders/<id>/tasks/<id> 200 38ms. Bỏ qua /health và kết nối socket.
 */
export function requestTiming() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const url = req.originalUrl.split('?')[0];
      if (url.endsWith('/health') || url.startsWith('/socket.io')) return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`[api] ${req.method} ${url} ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
    next();
  };
}
