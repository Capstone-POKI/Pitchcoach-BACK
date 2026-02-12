import { IsEmail, IsNotEmpty, Matches, Length } from 'class-validator';

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/; // phone: 형식 검증
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,16}$/; // 비밀번호: 형식 검증, 길이 8~16, 영문/숫자/특수문자 1개 이상

export class SignupDto {
  @IsNotEmpty() name: string; // name: 빈 문자열 X

  @IsEmail() email: string; // email: 이메일 형식

  @Matches(PHONE_REGEX, {
    message: '올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)',
  }) phone: string; 

  @Matches(PASSWORD_REGEX, {
    message: '비밀번호는 영어, 숫자, 특수문자 포함 8~16자여야 합니다',
  }) password: string; 
}