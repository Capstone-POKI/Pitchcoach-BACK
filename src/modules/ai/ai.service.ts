import { Injectable } from '@nestjs/common';
import { FastApiClient } from '../../infra/fastapi/fastapi.client';

@Injectable()
export class AiService {
  constructor(private readonly fastApi: FastApiClient) {}

  async test() {
    return this.fastApi.analyzeDocument('test-file-url');
  }
}
