import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,16}$/;

export class SignupDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @Matches(PHONE_REGEX, {
    message: '올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)',
  })
  phone: string;

  @Matches(PASSWORD_REGEX, {
    message: '비밀번호는 영어, 숫자, 특수문자 포함 8~16자여야 합니다',
  })
  password: string;
}
