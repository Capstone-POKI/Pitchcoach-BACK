import { ApiProperty } from '@nestjs/swagger';

export class UploadNoticeResponseDto {
  @ApiProperty()
  notice_id: string;

  @ApiProperty()
  pitch_id: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  analysis_status: string;

  @ApiProperty({ example: '공고문 분석이 시작되었습니다.' })
  message: string;
}
