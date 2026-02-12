import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { error } from 'console';

// 의존성 주입
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 1. 이메일 회원가입(/signup)
  async signup(dto: SignupDto) {

    // 이메일 중복 체크
    const existingEmail = await this.prisma.user.findUnique({
      where: {email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException({
        error: 'EMAIL_ALREADY_EXISTS',
        message: '이미 가입된 이메일입니다.',
      });
    }

    // 전화번호 중복 체크
    const existingPhone = await this.prisma.user.findUnique({
      where: {phone: dto.phone },
    });

    if (existingPhone) {
      throw new ConflictException({
        error: 'PHONE_ALREADY_EXISTS',
        message: '이미 가입된 전화번호입니다.',
      });
    }

    // 비밀번호 해시
    const hashed = await bcrypt.hash(dto.password, 10);

    // 유저 생성
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashed,
        authType: 'EMAIL',
        isProfileComplete: false,
      }
    });

    // JWT 발급
    const payload = { sub: user.id, email: user.email };
      const accessToken = this.jwtService.sign(payload);
      const refreshToken = this.jwtService.sign(payload, {
        expiresIn: '7d',
    });

    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      is_profile_complete: user.isProfileComplete,
      access_token: accessToken,
      refresh_token: refreshToken,
      message: '회원가입이 완료되었습니다. 추가 정보를 입력해주세요.',
    };
  }

  // 2. 이메일 로그인 (/login)
  async login(email: string, password: string) {

    // 이메일로 유저 조회
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 유저 미존재 시 에러
    if (!user) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      })
    }

    // 비밀번호 비교
    if(!user.password) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      })
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      });
    }


    // JWT 발급
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: '7d' },
    );

    // 응답 반환
    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      is_profile_complete: user.isProfileComplete,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}