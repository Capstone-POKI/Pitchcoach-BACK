import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
  @ApiOperation({ summary: '이메일 회원가입' })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({ description: '회원가입 성공' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '이메일 로그인' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: '로그인 성공' })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호 오류' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 프로필 조회' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: '내 프로필 조회 성공' })
  @ApiUnauthorizedResponse({ description: '유효하지 않은 토큰' })
  me(@Req() req: AuthenticatedRequest) {
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
}
