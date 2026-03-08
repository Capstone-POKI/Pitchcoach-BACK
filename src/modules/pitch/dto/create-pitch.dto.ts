import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

export enum PitchTypeEnum {
  ELEVATOR = 'ELEVATOR',
  VC_DEMO = 'VC_DEMO',
  GOVERNMENT = 'GOVERNMENT',
  COMPETITION = 'COMPETITION',
}

export enum NoticeTypeEnum {
  PDF = 'PDF',
  MANUAL = 'MANUAL',
  NONE = 'NONE',
}

export class CreatePitchDto {
  @ApiProperty({ example: '2024 스타트업 경진대회' })
  @IsString()
  title: string;

  @ApiProperty({ enum: PitchTypeEnum, example: 'GOVERNMENT' })
  @IsEnum(PitchTypeEnum)
  pitch_type: PitchTypeEnum;

  @ApiProperty({ example: 10, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  duration_minutes: number;

  @ApiProperty({ enum: NoticeTypeEnum, example: 'PDF' })
  @IsEnum(NoticeTypeEnum)
  notice_type: NoticeTypeEnum;
}
