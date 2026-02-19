import { ApiProperty } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty()
  auth_type: string;

  @ApiProperty({ nullable: true })
  gender: string | null;

  @ApiProperty({ nullable: true })
  education: string | null;

  @ApiProperty({ nullable: true })
  business_field: string | null;

  @ApiProperty({ nullable: true })
  business_duration: string | null;

  @ApiProperty()
  is_profile_complete: boolean;
}
