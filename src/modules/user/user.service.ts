import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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

  // PATCH /api/users/me/profile
  async updateProfile(userId: string, dto: UpdateProfileDto) {

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
      });
    }

    const data = {
      name: dto.name ?? user.name,
      phone: dto.phone ?? user.phone,
      gender: dto.gender ?? user.gender,
      education: dto.education ?? user.education,
      businessField: dto.business_field ?? user.businessField,
      businessDuration: dto.business_duration ?? user.businessDuration,
    };

    const isComplete =
      !!data.name &&
      !!data.phone &&
      !!data.gender &&
      !!data.education &&
      !!data.businessField &&
      !!data.businessDuration;

    let updatedUser;
    try {
      updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
          isProfileComplete: isComplete,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const targets = error.meta?.target ?? [];

        if (targets.includes('phone')) {
          throw new ConflictException({
            error: 'PHONE_ALREADY_EXISTS',
            message: '이미 가입된 전화번호입니다.',
          });
        }
      }
      throw error;
    }

    // ✅ 명세에 맞게 가공해서 반환
    return {
      user_id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      gender: updatedUser.gender,
      education: updatedUser.education,
      business_field: updatedUser.businessField,
      business_duration: updatedUser.businessDuration,
      is_profile_complete: updatedUser.isProfileComplete,
      updated_at: updatedUser.updatedAt,
    };
  }


  // DELETE /api/users/me
  async deleteUser(userId: string) {

    // 1. 유저 조회
    const user = await this.prisma.user.findUnique({
      where: {id: userId},
    });

    // 2. 탈퇴 가능 여부 체크
    if (!user || user.isDeleted) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
      });
    }

    // 3. soft delete 처리
    await this.prisma.user.update({
      where: {id: userId},
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return {
      message: '회원 탈퇴가 완료되었습니다.',
    };
  }

  // PATCH /api/users/me/password
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
      });
    }

    // Google 로그인 사용자 차단
    if (!user.password) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Google 로그인 사용자는 비밀번호 변경이 불가합니다',
      });
    }

    // 현재 비밀번호 확인
    const isMatch = await bcrypt.compare(
      dto.current_password,
      user.password,
    );

    if (!isMatch) {
      throw new UnauthorizedException({
        error: 'WRONG_PASSWORD',
        message: '현재 비밀번호가 올바르지 않습니다',
      });
    }

    // 새 비밀번호 해시
    const hashed = await bcrypt.hash(dto.new_password, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return {
      message: '비밀번호가 변경되었습니다.',
    };
  }
}
