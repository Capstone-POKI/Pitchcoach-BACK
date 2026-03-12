import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeckScoreDto {
  @ApiProperty()
  total_score: number;

  @ApiProperty()
  max_score: number;

  @ApiProperty()
  scoring_method: string;

  @ApiProperty({ additionalProperties: { type: 'number' } })
  criteria_weights: Record<string, number>;

  @ApiProperty()
  structure_summary: string;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  improvements: string[];
}

export class CriteriaScoreDto {
  @ApiProperty()
  criteria_name: string;

  @ApiProperty()
  pitchcoach_interpretation: string;

  @ApiProperty()
  ir_guide: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  max_score: number;

  @ApiPropertyOptional()
  raw_score?: number;

  @ApiPropertyOptional()
  raw_max_score?: number;

  @ApiPropertyOptional()
  coverage_status?: string;

  @ApiProperty({ type: [Number] })
  evidence_slides: number[];

  @ApiProperty()
  feedback: string;
}

export class EmphasizedSlideDto {
  @ApiProperty()
  slide_number: number;

  @ApiProperty()
  reason: string;
}

export class PresentationGuideDto {
  @ApiProperty({ type: [EmphasizedSlideDto] })
  emphasized_slides: EmphasizedSlideDto[];

  @ApiProperty({ type: [String] })
  guide: string[];

  @ApiProperty({ type: [String] })
  time_allocation: string[];
}

// IN_PROGRESS
export class DeckSummaryInProgressResponseDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  analysis_status: string;

  @ApiProperty()
  version: number;
}

// FAILED
export class DeckSummaryFailedResponseDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'FAILED' })
  analysis_status: string;

  @ApiProperty()
  error_message: string;

  @ApiProperty()
  version: number;
}

// COMPLETED
export class DeckSummaryCompletedResponseDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'COMPLETED' })
  analysis_status: string;

  @ApiProperty()
  version: number;

  @ApiProperty({ type: DeckScoreDto })
  deck_score: DeckScoreDto;

  @ApiProperty({ type: [CriteriaScoreDto] })
  criteria_scores: CriteriaScoreDto[];

  @ApiProperty({ type: PresentationGuideDto })
  presentation_guide: PresentationGuideDto;

  @ApiPropertyOptional()
  analyzed_at: string | null;
}
