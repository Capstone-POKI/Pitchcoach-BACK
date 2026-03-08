import { ApiProperty } from '@nestjs/swagger';

export class CreatePitchResponseDto {
  @ApiProperty({ example: 'uuid-1234' })
  pitch_id: string;

  @ApiProperty({ example: '2024 스타트업 경진대회' })
  title: string;

  @ApiProperty({ example: 'GOVERNMENT' })
  pitch_type: string;

  @ApiProperty({ example: 10 })
  duration_minutes: number;

  @ApiProperty({ example: 'SETUP' })
  status: string;

  @ApiProperty({ example: 0 })
  progress_percentage: number;

  @ApiProperty({ example: true })
  has_notice: boolean;

  @ApiProperty({ example: 'PDF' })
  notice_type: string;

  @ApiProperty({ example: 'GOV_RFP' })
  ir_template_key: string;

  @ApiProperty({ example: 'NOTICE_UPLOAD' })
  next_step: string;

  @ApiProperty({ example: '2026-02-06T10:00:00.000Z' })
  created_at: string;
}
