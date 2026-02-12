import { Injectable, ConflictException, BadRequestException} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';

// 의존성 주입
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
}