import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { NoticeModule } from './modules/notice/notice.module';
import { DeckModule } from './modules/deck/deck.module';
import { PitchModule } from './modules/pitch/pitch.module';
import { RehearsalModule } from './modules/rehearsal/rehearsal.module';

function getAllowedOrigins() {
  const defaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://pitchcoach.duckdns.org',
  ];

  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...configured])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // DTO 규칙 실행 엔진
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 필드는 자동 제거
      forbidNonWhitelisted: true, // DTO에 없는 필드 오면 400 반환
      transform: true, // 타입 자동 변환
    }),
  );

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('POKI API')
    .setDescription('POKI Backend API Docs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [
      AuthModule,
      UserModule,
      NoticeModule,
      DeckModule,
      PitchModule,
      RehearsalModule,
    ],
  });
  SwaggerModule.setup('api-docs', app, document);

  // Global Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
