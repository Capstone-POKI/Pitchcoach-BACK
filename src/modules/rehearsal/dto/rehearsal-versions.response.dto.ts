import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RehearsalVersionItemDto {
  @ApiProperty()
  voice_id: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  is_latest: boolean;

  @ApiPropertyOptional()
  total_score: number | null;

  @ApiPropertyOptional()
  wpm: number | null;

  @ApiPropertyOptional()
  audio_duration_seconds: number | null;

  @ApiPropertyOptional()
  audio_duration_display: string | null;

  @ApiPropertyOptional()
  audio_file_url: string | null;

  @ApiProperty()
  analysis_status: string;

  @ApiPropertyOptional()
  analyzed_at: string | null;
}

export class RehearsalVersionsResponseDto {
  @ApiProperty()
  pitch_id: string;

  @ApiProperty()
  total_versions: number;

  @ApiProperty({ type: [RehearsalVersionItemDto] })
  versions: RehearsalVersionItemDto[];
}
