import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export enum UpdatePitchStatusEnum {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class UpdatePitchStatusDto {
  @ApiProperty({ enum: UpdatePitchStatusEnum, example: 'COMPLETED' })
  @IsString()
  status: UpdatePitchStatusEnum;
}
