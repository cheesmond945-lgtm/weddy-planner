import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { detectDbFeatures, pendingSqlFiles } from './prisma/db-features';

async function bootstrap() {
  // DB dùng chung chưa chạy SQL thủ công mới thì vẫn khởi động được: bỏ cột mới khỏi truy vấn, khóa tính năng mới
  await detectDbFeatures(process.env.DATABASE_URL);
  const pending = pendingSqlFiles();
  if (pending.length) console.warn(`[DB] Chưa chạy SQL: ${pending.join(', ')}. Các tính năng cần file này trả 503 DB_MIGRATION_PENDING (docs/LICH_SU_THAY_DOI_DB.md).`);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor(app.get(Reflector)));
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Everly API: http://localhost:${port}/api/health`);
}
bootstrap();
