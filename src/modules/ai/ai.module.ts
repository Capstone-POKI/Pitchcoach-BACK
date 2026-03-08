import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { FastApiModule } from '../../infra/fastapi/fastapi.module';

@Module({
  imports: [FastApiModule], // 👈 이거 반드시 추가
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
