import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches, Length } from 'class-validator';

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;
const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,16}$/;

export class SignupDto {
  @ApiProperty({
    example: '홍길동',
    description: '사용자 이름',
    required: true,
  })
  @IsNotEmpty({ message: '이름은 필수입니다' })
  name: string;

  @ApiProperty({
    example: 'example@example.com',
    description: '이메일',
    required: true,
  })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  email: string;

  @ApiProperty({
    example: '010-1234-5678',
    description: '휴대폰 번호 (010-0000-0000 형식)',
    required: true,
  })
  @Matches(PHONE_REGEX, {
    message: '올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)',
  })
  phone: string;

  @ApiProperty({
    example: 'Abc12345!',
    description:
      '비밀번호 (영문, 숫자, 특수문자 포함 8~16자)',
    required: true,
  })
  @Length(8, 16, {
    message: '비밀번호는 8자 이상 16자 이하입니다',
  })
  @Matches(PASSWORD_REGEX, {
    message:
      '비밀번호는 영어, 숫자, 특수문자(@$!%*#?&) 포함 8~16자여야 합니다',
  })
  password: string;
}
