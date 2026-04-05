import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeckVersionItemDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  is_latest: boolean;

  @ApiPropertyOptional()
  total_score: number | null;

  @ApiProperty()
  total_slides: number;

  @ApiPropertyOptional()
  pdf_url: string | null;

  @ApiProperty()
  analysis_status: string;

  @ApiPropertyOptional()
  analyzed_at: string | null;
}

export class DeckVersionsResponseDto {
  @ApiProperty()
  pitch_id: string;

  @ApiProperty()
  total_versions: number;

  @ApiProperty({ type: [DeckVersionItemDto] })
  versions: DeckVersionItemDto[];
}
