import { Module } from '@nestjs/common';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';
import { FastApiModule } from '../../infra/fastapi/fastapi.module';

@Module({
  imports: [FastApiModule],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService],
})
export class QaModule {}
