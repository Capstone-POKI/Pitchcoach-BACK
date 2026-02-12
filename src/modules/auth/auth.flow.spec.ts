import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('Auth flow', () => {
  const jwtSecret = 'unit-test-secret';
  const password = 'Passw0rd!';

  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn((key: string) => (key === 'JWT_SECRET' ? jwtSecret : undefined)),
  };

  const jwtService = new JwtService({ secret: jwtSecret });
  const authService = new AuthService(prisma as any, jwtService);
  const authController = new AuthController(authService);
  const jwtStrategy = new JwtStrategy(prisma as any, configService as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({});
  });

  it('정상 로그인 후 /me 흐름이 성공한다', async () => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: 'u-1',
      email: 'active@example.com',
      name: 'Active User',
      phone: '010-1234-5678',
      authType: 'EMAIL',
      gender: null,
      education: null,
      businessField: null,
      businessDuration: null,
      isProfileComplete: false,
      isDeleted: false,
      password: hashedPassword,
    };

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.findUnique.mockResolvedValue(user);

    const loginResult = await authService.login(user.email, password);
    expect(loginResult.access_token).toBeDefined();

    const payload = jwtService.verify(loginResult.access_token) as {
      sub: string;
      email: string;
      type?: string;
    };

    const validatedUser = await jwtStrategy.validate(payload);
    const meResult = authController.me({ user: validatedUser } as any);

    expect(meResult.user_id).toBe(user.id);
    expect(meResult.email).toBe(user.email);
  });

  it('삭제 계정은 로그인 시 401을 반환한다', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      authService.login('deleted@example.com', password),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh 토큰이 탈취되어도 보호 API 접근을 차단한다', async () => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: 'u-2',
      email: 'active2@example.com',
      name: 'Active User 2',
      phone: '010-2222-3333',
      authType: 'EMAIL',
      gender: null,
      education: null,
      businessField: null,
      businessDuration: null,
      isProfileComplete: false,
      isDeleted: false,
      password: hashedPassword,
    };

    prisma.user.findFirst.mockResolvedValue(user);

    const loginResult = await authService.login(user.email, password);
    const refreshPayload = jwtService.verify(loginResult.refresh_token) as {
      sub: string;
      type?: string;
    };

    await expect(jwtStrategy.validate(refreshPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
