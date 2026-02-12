import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,16}$/;

export class SignupDto {
  @ApiProperty({ example: '홍길동', description: '사용자 이름' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'user@example.com', description: '이메일' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '010-1234-5678',
    description: '휴대폰 번호',
  })
  @Matches(PHONE_REGEX, {
    message: '올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)',
  })
  phone: string;

  @ApiProperty({
    example: 'Passw0rd!',
    description: '영문/숫자/특수문자 포함 8~16자 비밀번호',
  })
  @Matches(PASSWORD_REGEX, {
    message: '비밀번호는 영어, 숫자, 특수문자 포함 8~16자여야 합니다',
  })
  password: string;
}
