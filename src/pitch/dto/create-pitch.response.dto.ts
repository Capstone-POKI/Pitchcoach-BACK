import { ApiProperty } from '@nestjs/swagger';
import { PitchStatus, PitchType } from '@prisma/client';
import { NoticeType } from './notice-type.enum';

export class CreatePitchResponseDto {

  @ApiProperty()
  pitch_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: PitchType })
  pitch_type: PitchType;

  @ApiProperty()
  duration_minutes: number;

  @ApiProperty({ enum: PitchStatus })
  status: PitchStatus;

  @ApiProperty()
  progress_percentage: number;

  @ApiProperty()
  has_notice: boolean;

  @ApiProperty({ enum: NoticeType })
  notice_type: NoticeType;

  @ApiProperty()
  next_step: string;

  @ApiProperty()
  created_at: Date;
}
