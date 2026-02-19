import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

export class UpdateProfileResponseDto {

  @ApiProperty({ example: 'uuid-user-1' })
  user_id: string;

  @ApiProperty({ example: '홍길동' })
  name: string;

  @ApiProperty({ example: '010-5678-1234' })
  phone: string;

  @ApiProperty({ enum: Gender, example: 'MALE' })
  gender: Gender;

  @ApiProperty({ example: '대학원 졸업' })
  education: string;

  @ApiProperty({ example: 'AI/IT' })
  business_field: string;

  @ApiProperty({ example: '3년 이상' })
  business_duration: string;

  @ApiProperty({ example: true })
  is_profile_complete: boolean;

  @ApiProperty({ example: '2026-02-06T10:00:00Z' })
  updated_at: Date;
}
