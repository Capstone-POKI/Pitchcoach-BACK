import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface JwtPayload {
  sub?: string;
  email?: string;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: '토큰이 유효하지 않습니다',
      });
    }

    if (payload.type === 'refresh') {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: '토큰이 유효하지 않습니다',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: '토큰이 유효하지 않습니다',
      });
    }

    return user;
  }
}
