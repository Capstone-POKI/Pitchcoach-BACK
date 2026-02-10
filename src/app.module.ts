import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AiModule } from './modules/ai/ai.module';
import { FastApiModule } from './infra/fastapi/fastapi.module';
import { AuthModule } from './modules/auth/auth.module';



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
  ],
})
export class AppModule {}
