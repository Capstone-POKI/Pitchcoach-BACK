import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvaluationCriteriaItemDto {
  @ApiProperty()
  criteria_name: string;

  @ApiProperty()
  points: number;

  @ApiProperty()
  pitchcoach_interpretation: string;

  @ApiProperty()
  ir_guide: string;
}

export class NoticeResultInProgressResponseDto {
  @ApiProperty()
  notice_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  analysis_status: string;

  @ApiProperty()
  updated_at: Date;
}

export class NoticeResultFailedResponseDto {
  @ApiProperty()
  notice_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'FAILED' })
  analysis_status: string;

  @ApiProperty()
  error_message: string;

  @ApiProperty()
  updated_at: Date;
}

export class NoticeResultCompletedResponseDto {
  @ApiProperty()
  notice_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'COMPLETED' })
  analysis_status: string;

  @ApiPropertyOptional()
  notice_name: string | null;

  @ApiPropertyOptional()
  host_organization: string | null;

  @ApiPropertyOptional()
  recruitment_type: string | null;

  @ApiPropertyOptional()
  target_audience: string | null;

  @ApiPropertyOptional()
  application_period: string | null;

  @ApiProperty({ type: [EvaluationCriteriaItemDto] })
  evaluation_criteria: EvaluationCriteriaItemDto[];

  @ApiPropertyOptional()
  additional_criteria: string | null;

  @ApiPropertyOptional()
  ir_deck_guide: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
