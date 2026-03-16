import { Module } from '@nestjs/common';
import { RehearsalController } from './rehearsal.controller';
import { RehearsalService } from './rehearsal.service';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { FastApiModule } from '../../infra/fastapi/fastapi.module';

@Module({
  imports: [PrismaModule, FastApiModule],
  controllers: [RehearsalController],
  providers: [RehearsalService],
})
export class RehearsalModule {}
