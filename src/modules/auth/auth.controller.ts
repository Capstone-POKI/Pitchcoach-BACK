import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
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

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
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
