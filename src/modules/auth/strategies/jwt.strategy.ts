import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../infra/prisma/prisma.service';





@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: process.env.JWT_SECRET as string,
  });
}

async validate(payload: any) {
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
