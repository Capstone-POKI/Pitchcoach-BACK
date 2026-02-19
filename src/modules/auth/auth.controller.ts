import {Controller, Post, Body, Get, UseGuards, Req, } from '@nestjs/common';
import { ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MeResponseDto } from './dto/me-response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    authType: string;
    gender: string | null;
    education: string | null;
    businessField: string | null;
    businessDuration: string | null;
    isProfileComplete: boolean;
  };
}

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED) // 201
  @ApiOperation({ summary: '이메일 회원가입' })
  @ApiBody({ type: SignupDto })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    schema: {
      example: {
        user_id: 'uuid-user-1',
        email: 'example@example.com',
        name: '홍길동',
        is_profile_complete: false,
        access_token: 'eyJhbG...',
        refresh_token: 'eyJhbG...',
        message: '회원가입이 완료되었습니다. 추가 정보를 입력해주세요.',
      },
    },
  })
  @ApiBadRequestResponse({
    description: '비밀번호 형식 오류',
    schema: {
      example: {
        error: 'INVALID_PASSWORD',
        message: '비밀번호는 영어, 숫자, 특수문자 포함 8~16자여야 합니다',
      },
    },
  })
  @ApiConflictResponse({
    description: '이메일 또는 전화번호 중복',
    schema: {
      example: {
        error: 'EMAIL_ALREADY_EXISTS',
        message: '이미 가입된 이메일입니다.',
      },
    },
  })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }


  @Post('login')
  @ApiOperation({ summary: '이메일 로그인' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: '로그인 성공',
    schema: {
      example: {
        user_id: 'uuid-user-1',
        email: 'example@example.com',
        name: '홍길동',
        is_profile_complete: true,
        access_token: 'eyJhbG...',
        refresh_token: 'eyJhbG...',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '이메일 또는 비밀번호 오류',
    schema: {
      example: {
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다',
      },
    },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }


  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 프로필 조회' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: '내 프로필 조회 성공',
    type: MeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '유효하지 않은 토큰',
    schema: {
      example: {
        error: 'UNAUTHORIZED',
        message: '토큰이 유효하지 않습니다',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '토큰 만료',
    schema: {
      example: {
        error: 'TOKEN_EXPIRED',
        message: '토큰이 만료되었습니다',
      },
    },
  })
  me(@Req() req: AuthenticatedRequest): MeResponseDto {
    const user = req.user;

    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      auth_type: user.authType,
      gender: user.gender,
      education: user.education,
      business_field: user.businessField,
      business_duration: user.businessDuration,
      is_profile_complete: user.isProfileComplete,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: '토큰 갱신' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({
    description: '토큰 갱신 성공',
    schema: {
      example: {
        access_token: 'eyJhbG...(new)',
        refresh_token: 'eyJhbG...(new)',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '리프레시 토큰 오류',
    schema: {
      oneOf: [
        {
          example: {
            error: 'INVALID_REFRESH_TOKEN',
            message: '유효하지 않은 리프레시 토큰입니다',
          },
        },
        {
          example: {
            error: 'REFRESH_TOKEN_EXPIRED',
            message:
              '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
          },
        },
      ],
    },
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '로그아웃' })
  @ApiBearerAuth()
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({
    description: '로그아웃 성공',
    schema: {
      example: {
        message: '로그아웃되었습니다.',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '리프레시 토큰 오류',
  })
  logout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: LogoutDto,
  ) {
    return this.authService.logout(
      req.user.id,
      dto.refresh_token,
    );
  }
}
