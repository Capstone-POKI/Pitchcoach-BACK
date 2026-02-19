import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google OAuth ID Token',
    example: 'google-oauth-id-token...',
  })
  @IsString()
  @IsNotEmpty()
  id_token: string;
}
