import { Module } from '@nestjs/common';
import { DeckController } from './deck.controller';
import { DeckService } from './deck.service';
import { FastApiModule } from '../../infra/fastapi/fastapi.module';

@Module({
  imports: [FastApiModule],
  controllers: [DeckController],
  providers: [DeckService],
  exports: [DeckService],
})
export class DeckModule {}
