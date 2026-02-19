import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @ApiProperty({
    description: '영어+숫자+특수문자 포함 8~16자',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,16}$/, {
    message:
      '새 비밀번호는 영어, 숫자, 특수문자 포함 8~16자여야 합니다',
  })
  new_password: string;
}
