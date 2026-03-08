import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class EvaluationCriteriaUpdateItemDto {
  @IsString()
  criteria_name: string;

  @IsInt()
  @Min(0)
  points: number;
}

export class UpdateNoticeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notice_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  host_organization?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recruitment_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  target_audience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  application_period?: string;

  @ApiPropertyOptional({ type: [EvaluationCriteriaUpdateItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationCriteriaUpdateItemDto)
  evaluation_criteria?: EvaluationCriteriaUpdateItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additional_criteria?: string;
}
