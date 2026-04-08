import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';

export enum QAModeEnum {
  REALTIME = 'REALTIME',
  GUIDE_ONLY = 'GUIDE_ONLY',
}

export class SetQAModeDto {
  @ApiProperty({
    enum: QAModeEnum,
    example: 'REALTIME',
    description: 'Q&A 훈련 방식 (REALTIME: 실제 질문에 음성으로 답변, GUIDE_ONLY: 질문과 가이드만 확인)',
  })
  @IsEnum(QAModeEnum)
  qa_mode: QAModeEnum;

  @ApiProperty({
    example: false,
    description: '기존 질문이 있어도 새로 생성할지 여부 (기본값: false)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  force_regenerate?: boolean = false;
}
