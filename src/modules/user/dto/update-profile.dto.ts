import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Gender } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {

  @ApiPropertyOptional({
    description: '이름 (선택)',
    example: '홍길동',
  })
  @IsOptional()
  @IsString()
  name?: string;


  @ApiPropertyOptional({
    description: '전화번호 (선택) - 010-1234-5678 형식',
    example: '010-5678-1234',
  })
  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]-?\d{3,4}-?\d{4}$/, {
    message: '전화번호 형식이 올바르지 않습니다.',
  })
  phone?: string;


  @ApiPropertyOptional({
    description: '성별 (선택) - MALE | FEMALE',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;


  @ApiPropertyOptional({
    description: '최종 학력 (선택)',
    example: '대학원 졸업',
  })
  @IsOptional()
  @IsString()
  education?: string;


  @ApiPropertyOptional({
    description: '창업 분야 (선택) - 드롭다운 선택 또는 직접 입력 값',
    example: 'AI/IT',
  })
  @IsOptional()
  @IsString()
  business_field?: string;


  @ApiPropertyOptional({
    description: '창업 기간 (선택) - 드롭다운 선택 또는 직접 입력 값',
    example: '3년 이상',
  })
  @IsOptional()
  @IsString()
  business_duration?: string;
}
