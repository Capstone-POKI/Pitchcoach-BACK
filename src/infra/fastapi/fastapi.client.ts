import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FastApiClient {
  private readonly baseUrl = process.env.AI_SERVER_URL;

  async analyzeDocument(fileUrl: string) {
    const res = await axios.post(
      `${this.baseUrl}/analyze/document`,
      { fileUrl }
    );
    return res.data;
  }
}
