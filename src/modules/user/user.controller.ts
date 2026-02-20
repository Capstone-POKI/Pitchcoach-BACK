import {
  Controller,
  Patch,
  Delete,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileResponseDto } from './dto/update-profile-response.dto';

@Controller('api/users')
export class UserController {
  constructor(private userService: UserService) {}

  // PATCH /api/users/me/profile
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me/profile')
  @ApiOperation({ summary: '프로필 수정' })
  @ApiResponse({
    status: 200,
    description: '프로필 수정 성공',
    type: UpdateProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'UNAUTHORIZED',
  })
  async updateProfile(
    @Req() req,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(req.user.id, dto);
  }

  // DELETE /api/users/me
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('me')
  @ApiOperation({ summary: '회원 탈퇴' })
  @ApiOkResponse({
    description: '회원 탈퇴 성공',
    schema: {
      example: {
        message: '회원 탈퇴가 완료되었습니다!',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'UNAUTHORIZED',
  })
  async deleteMe(@Req() req) {
    return this.userService.deleteUser(req.user.id);
  }

  // PATCH /api/users/me/password
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me/password')
  @ApiOperation({ summary: '비밀번호 변경' })
  @ApiOkResponse({
    description: '비밀번호 변경 성공',
    schema: {
      example: {
        message: '비밀번호가 변경되었습니다.',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'UNAUTHORIZED',
  })
  async changePassword(
    @Req() req,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(req.user.id, dto);
  }

}
