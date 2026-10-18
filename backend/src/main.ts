import './common/utils/load-env.js'
import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module.js'
import { validationExceptionFactory } from './common/utils/validation-exception.factory.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')
  app.enableShutdownHooks()

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Weddy Planner API')
    .setDescription('Quy ước chung xem docs/api/README.md')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  Logger.log(`API: http://localhost:${port}/api  |  Swagger: http://localhost:${port}/api/docs`, 'Bootstrap')
}

void bootstrap()
