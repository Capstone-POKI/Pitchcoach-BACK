import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';

const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      error: 'INVALID_CREDENTIALS',
      message: '이메일 또는 비밀번호가 올바르지 않습니다',
    });
  }

  private async issueTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash,
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        lastLoginAt: new Date(),
      },
    });

    return { accessToken, refreshToken };
  }

  async signup(dto: SignupDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException({
        error: 'EMAIL_ALREADY_EXISTS',
        message: '이미 가입된 이메일입니다.',
      });
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existingPhone) {
      throw new ConflictException({
        error: 'PHONE_ALREADY_EXISTS',
        message: '이미 가입된 전화번호입니다.',
      });
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashed,
        authType: 'EMAIL',
        isProfileComplete: false,
      },
    });

    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.email,
    );

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

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isDeleted: false,
      },
    });

    if (!user || !user.password) {
      this.throwInvalidCredentials();
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      this.throwInvalidCredentials();
    }

    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.email,
    );

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
