import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { GoogleAuthService } from './google-auth.service';

const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private googleAuthService: GoogleAuthService,
  ) {}

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      error: 'INVALID_CREDENTIALS',
      message: '이메일 또는 비밀번호가 올바르지 않습니다',
    });
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is { code: string; meta?: { target?: string[] } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
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

    try {
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
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const targets = error.meta?.target ?? [];

        if (targets.includes('email')) {
          throw new ConflictException({
            error: 'EMAIL_ALREADY_EXISTS',
            message: '이미 가입된 이메일입니다.',
          });
        }

        if (targets.includes('phone')) {
          throw new ConflictException({
            error: 'PHONE_ALREADY_EXISTS',
            message: '이미 가입된 전화번호입니다.',
          });
        }
      }
      throw error;
    }
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

  async refresh(refreshToken: string) {
    try {
      const payload: { sub: string; type: string } =
        this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException({
          error: 'INVALID_REFRESH_TOKEN',
          message: '유효하지 않은 리프레시 토큰입니다',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
        throw new UnauthorizedException({
          error: 'INVALID_REFRESH_TOKEN',
          message: '유효하지 않은 리프레시 토큰입니다',
        });
      }

      // 만료 체크
      if (user.refreshTokenExpiresAt < new Date()) {
        throw new UnauthorizedException({
          error: 'REFRESH_TOKEN_EXPIRED',
          message: '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
        });
      }

      // 해시 비교
      const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

      if (!isMatch) {
        throw new UnauthorizedException({
          error: 'INVALID_REFRESH_TOKEN',
          message: '유효하지 않은 리프레시 토큰입니다',
        });
      }

      // 🔥 Rotation
      const { accessToken, refreshToken: newRefresh } = await this.issueTokens(
        user.id,
        user.email,
      );

      return {
        access_token: accessToken,
        refresh_token: newRefresh,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException({
          error: 'REFRESH_TOKEN_EXPIRED',
          message: '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
        });
      }

      throw new UnauthorizedException({
        error: 'INVALID_REFRESH_TOKEN',
        message: '유효하지 않은 리프레시 토큰입니다',
      });
    }
  }

  async logout(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException({
        error: 'INVALID_REFRESH_TOKEN',
        message: '유효하지 않은 리프레시 토큰입니다',
      });
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isMatch) {
      throw new UnauthorizedException({
        error: 'INVALID_REFRESH_TOKEN',
        message: '유효하지 않은 리프레시 토큰입니다',
      });
    }

    // 🔥 무효화
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return {
      message: '로그아웃되었습니다.',
    };
  }

  async googleLogin(idToken: string) {
    const googleUser = await this.googleAuthService.validateIdToken(idToken);

    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    let isNewUser = false;

    if (user?.isDeleted) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      });
    }

    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            email: googleUser.email,
            name: googleUser.name,
            authType: 'GOOGLE',
            isProfileComplete: false,
          },
        });
        isNewUser = true;
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          user = await this.prisma.user.findUnique({
            where: { email: googleUser.email },
          });
        } else {
          throw error;
        }
      }
    }

    if (!user || user.isDeleted) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      });
    }

    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.email,
    );

    return {
      user,
      isNewUser,
      accessToken,
      refreshToken,
    };
  }
}
