import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestContext } from './common/request-context';
import { ResponseInterceptor } from './common/response.interceptor';
import { SERVER_DEFAULTS } from './common/runtime.constants';
import { UPLOAD_ROOT_DIR, UPLOAD_URL_PREFIX } from './common/upload.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), UPLOAD_ROOT_DIR), { prefix: UPLOAD_URL_PREFIX });
  const allowedOrigins = (process.env.CORS_ORIGIN || SERVER_DEFAULTS.CORS_ORIGINS.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use((request, _response, next) => {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : String(forwardedFor || request.ip || request.socket?.remoteAddress || '').split(',')[0].trim() || null;
    const userAgent = String(request.headers['user-agent'] || '').trim() || null;
    requestContext.run({ ipAddress, userAgent }, next);
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(Number(process.env.PORT || SERVER_DEFAULTS.PORT));
}

bootstrap();
