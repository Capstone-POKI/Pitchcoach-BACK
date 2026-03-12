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

// ── IR Deck 타입 ──

export interface AiIrUploadResponse {
  ir_deck_id: string;
  pitch_id: string;
  analysis_status: string;
  version: number;
  message: string;
}

export interface AiDeckScore {
  total_score: number;
  max_score?: number;
  scoring_method?: string;
  criteria_weights?: Record<string, number>;
  structure_summary: string;
  strengths: string[];
  improvements: string[];
}

export interface AiCriteriaScore {
  criteria_name: string;
  pitchcoach_interpretation: string;
  ir_guide: string;
  score: number;
  max_score?: number;
  raw_score?: number;
  raw_max_score?: number;
  coverage_status?: string;
  evidence_slides?: number[];
  related_slides?: number[];
  feedback: string;
}

export interface AiEmphasizedSlide {
  slide_number: number;
  reason: string;
}

export interface AiPresentationGuide {
  emphasized_slides: AiEmphasizedSlide[];
  guide: string[];
  time_allocation: string[];
}

export interface AiIrSummaryResponse {
  ir_deck_id: string;
  pitch_id: string;
  analysis_status: string;
  version: number;
  deck_score?: AiDeckScore;
  criteria_scores?: AiCriteriaScore[];
  presentation_guide?: AiPresentationGuide;
  error_message?: string;
  analyzed_at?: string;
}

export interface AiIrSlideItem {
  slide_number: number;
  category: string;
  score: number;
  thumbnail_url: string | null;
  content_summary: string;
  detailed_feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface AiIrSlidesResponse {
  ir_deck_id: string;
  analysis_status: string;
  total_slides?: number;
  slides?: AiIrSlideItem[];
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

  // ── IR Deck ──

  async uploadIrDeckAndAnalyze(
    pitchId: string,
    fileBuffer: Buffer,
    filename: string,
    strategy?: Record<string, unknown> | null,
    pitchType?: string | null,
  ): Promise<AiIrUploadResponse> {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename,
      contentType: 'application/pdf',
    });
    if (strategy) {
      form.append('strategy_json', JSON.stringify(strategy));
    }
    if (pitchType) {
      form.append('pitch_type', pitchType);
    }

    const res = await axios.post(
      `${this.baseUrl}/api/pitches/${pitchId}/ir-decks/analyze`,
      form,
      { headers: form.getHeaders() },
    );
    return res.data as AiIrUploadResponse;
  }

  async getIrDeckResult(aiJobId: string): Promise<AiIrSummaryResponse> {
    const res = await axios.get(`${this.baseUrl}/api/ir-decks/${aiJobId}`);
    return res.data as AiIrSummaryResponse;
  }

  async getIrDeckSlides(aiJobId: string): Promise<AiIrSlidesResponse> {
    const res = await axios.get(`${this.baseUrl}/api/ir-decks/${aiJobId}/slides`);
    return res.data as AiIrSlidesResponse;
  }
}
