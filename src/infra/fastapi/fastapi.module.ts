import { Module } from '@nestjs/common';
import { FastApiClient } from './fastapi.client';

@Module({
  providers: [FastApiClient],
  exports: [FastApiClient],
})
export class FastApiModule {}
