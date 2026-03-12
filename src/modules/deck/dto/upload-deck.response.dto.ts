import { ApiProperty } from '@nestjs/swagger';

export class UploadDeckResponseDto {
  @ApiProperty()
  ir_deck_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  analysis_status: string;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: 'IR Deck 분석이 시작되었습니다.' })
  message: string;
}
