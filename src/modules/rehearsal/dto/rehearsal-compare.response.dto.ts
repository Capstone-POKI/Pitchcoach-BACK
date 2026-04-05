import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RehearsalCompareSummaryDto {
  @ApiProperty()
  voice_id: string;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  total_score: number | null;

  @ApiPropertyOptional()
  wpm: number | null;

  @ApiPropertyOptional()
  audio_duration_display: string | null;

  @ApiPropertyOptional()
  analyzed_at: string | null;
}

export class DetailScoreComparisonItemDto {
  @ApiProperty()
  category_name: string;

  @ApiProperty()
  category_display_name: string;

  @ApiProperty()
  current_score: number;

  @ApiPropertyOptional()
  previous_score: number | null;

  @ApiPropertyOptional()
  diff: number | null;
}

export class RehearsalSlideComparisonItemDto {
  @ApiProperty()
  slide_number: number;

  @ApiProperty()
  category: string;

  @ApiProperty()
  current_score: number;

  @ApiPropertyOptional()
  previous_score: number | null;

  @ApiPropertyOptional()
  diff: number | null;
}

export class RehearsalCompareResponseDto {
  @ApiProperty({ type: RehearsalCompareSummaryDto })
  current: RehearsalCompareSummaryDto;

  @ApiPropertyOptional({ type: RehearsalCompareSummaryDto, nullable: true })
  previous: RehearsalCompareSummaryDto | null;

  @ApiPropertyOptional({ nullable: true })
  score_diff: number | null;

  @ApiProperty({ type: [DetailScoreComparisonItemDto] })
  detail_score_comparisons: DetailScoreComparisonItemDto[];

  @ApiProperty({ type: [RehearsalSlideComparisonItemDto] })
  slide_comparisons: RehearsalSlideComparisonItemDto[];

  @ApiProperty({ type: [String] })
  improved_items: string[];
}
