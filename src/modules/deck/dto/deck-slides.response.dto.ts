import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SlideItemDto {
  @ApiProperty()
  slide_number: number;

  @ApiProperty()
  category: string;

  @ApiProperty()
  score: number;

  @ApiPropertyOptional()
  thumbnail_url: string | null;

  @ApiProperty()
  content_summary: string;

  @ApiProperty()
  detailed_feedback: string;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  improvements: string[];
}

// IN_PROGRESS
export class DeckSlidesInProgressResponseDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  analysis_status: string;
}

// COMPLETED
export class DeckSlidesCompletedResponseDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty({ example: 'COMPLETED' })
  analysis_status: string;

  @ApiProperty()
  total_slides: number;

  @ApiProperty({ type: [SlideItemDto] })
  slides: SlideItemDto[];
}
