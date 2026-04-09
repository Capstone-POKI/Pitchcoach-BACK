import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AiModule } from './modules/ai/ai.module';
import { FastApiModule } from './infra/fastapi/fastapi.module';
import { AuthModule } from './modules/auth/auth.module';
import { NoticeModule } from './modules/notice/notice.module';
import { DeckModule } from './modules/deck/deck.module';
import { PitchModule } from './modules/pitch/pitch.module';
import { RehearsalModule } from './modules/rehearsal/rehearsal.module';
import { QaModule } from './modules/qa/qa.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UserModule,
    AiModule,
    FastApiModule,
    AuthModule,
    NoticeModule,
    DeckModule,
    PitchModule,
    RehearsalModule,
    QaModule,
  ],
})
export class AppModule {}
