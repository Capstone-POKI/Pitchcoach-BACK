import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum PitchListStatusEnum {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class ListPitchesDto {
  @ApiPropertyOptional({
    enum: PitchListStatusEnum,
    description: 'IN_PROGRESS | COMPLETED',
  })
  @IsOptional()
  @IsEnum(PitchListStatusEnum)
  status?: PitchListStatusEnum;

  @ApiPropertyOptional({ description: '제목 기준 검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
