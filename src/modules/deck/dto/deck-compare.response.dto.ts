import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeckCompareSummaryDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  total_score: number | null;

  @ApiProperty()
  total_slides: number;

  @ApiPropertyOptional()
  analyzed_at: string | null;
}

export class SlideComparisonItemDto {
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

export class DeckCompareResponseDto {
  @ApiProperty({ type: DeckCompareSummaryDto })
  current: DeckCompareSummaryDto;

  @ApiPropertyOptional({ type: DeckCompareSummaryDto, nullable: true })
  previous: DeckCompareSummaryDto | null;

  @ApiPropertyOptional({ nullable: true })
  score_diff: number | null;

  @ApiProperty({ type: [SlideComparisonItemDto] })
  slide_comparisons: SlideComparisonItemDto[];

  @ApiProperty({ type: [String] })
  improved_items: string[];
}
