import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

export interface AiEvaluationCriteria {
  criteria_name: string;
  points: number;
  pitchcoach_interpretation: string;
  ir_guide: string;
}

export interface AiNoticeUploadResponse {
  notice_id: string;
  pitch_id: string;
  analysis_status: string;
  message: string;
}

export interface AiNoticeResultResponse {
  notice_id: string;
  pitch_id: string;
  analysis_status: string;
  notice_name?: string | null;
  host_organization?: string | null;
  recruitment_type?: string | null;
  target_audience?: string | null;
  application_period?: string | null;
  evaluation_criteria?: AiEvaluationCriteria[];
  additional_criteria?: string | null;
  ir_deck_guide?: string | null;
  error_message?: string | null;
  updated_at?: string;
  created_at?: string;
}

@Injectable()
export class FastApiClient {
  private readonly logger = new Logger(FastApiClient.name);
  private readonly baseUrl = process.env.AI_SERVER_URL;

  async analyzeDocument(fileUrl: string): Promise<Record<string, unknown>> {
    const res = await axios.post(`${this.baseUrl}/analyze/document`, {
      fileUrl,
    });
    return res.data as Record<string, unknown>;
  }

  async uploadNoticeAndAnalyze(
    pitchId: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<AiNoticeUploadResponse> {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename,
      contentType: 'application/pdf',
    });

    const res = await axios.post(
      `${this.baseUrl}/api/pitches/${pitchId}/notices/analyze`,
      form,
      { headers: form.getHeaders() },
    );
    return res.data as AiNoticeUploadResponse;
  }

  async getNoticeResult(noticeId: string): Promise<AiNoticeResultResponse> {
    const res = await axios.get(`${this.baseUrl}/api/notices/${noticeId}`);
    return res.data as AiNoticeResultResponse;
  }

  async updateNotice(
    noticeId: string,
    body: Record<string, unknown>,
  ): Promise<AiNoticeResultResponse> {
    const res = await axios.patch(
      `${this.baseUrl}/api/notices/${noticeId}`,
      body,
    );
    return res.data as AiNoticeResultResponse;
  }
}
