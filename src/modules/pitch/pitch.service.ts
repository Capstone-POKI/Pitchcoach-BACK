import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreatePitchDto, NoticeTypeEnum } from './dto/create-pitch.dto';
import { CreatePitchResponseDto } from './dto/create-pitch.response.dto';
import {
  ListPitchesDto,
  PitchListStatusEnum,
} from './dto/list-pitches.dto';
import {
  UpdatePitchStatusDto,
  UpdatePitchStatusEnum,
} from './dto/update-pitch-status.dto';

const IR_TEMPLATE_MAP: Record<string, string> = {
  ELEVATOR: 'ELEVATOR_BASIC',
  VC_DEMO: 'VC_STANDARD',
  GOVERNMENT: 'GOV_RFP',
  COMPETITION: 'COMPETITION_STANDARD',
};

function nextStep(noticeType: string): string {
  if (noticeType === 'NONE') return 'IRDECK_UPLOAD';
  if (noticeType === 'PDF') return 'NOTICE_UPLOAD';
  return 'NOTICE_MANUAL';
}

function mapPitchTypeDisplay(pitchType: string): string {
  const labelMap: Record<string, string> = {
    ELEVATOR: '엘리베이터 피치',
    VC_DEMO: 'VC 데모데이',
    GOVERNMENT: '정부지원사업',
    COMPETITION: '창업경진대회',
  };
  return labelMap[pitchType] ?? pitchType;
}

function mapPitchStatus(status: string): 'IN_PROGRESS' | 'COMPLETED' {
  return status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
}

@Injectable()
export class PitchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreatePitchDto,
  ): Promise<CreatePitchResponseDto> {
    if (dto.duration_minutes < 1 || dto.duration_minutes > 20) {
      throw new BadRequestException({
        error: 'INVALID_REQUEST',
        message: '필수 항목 누락 또는 유효하지 않은 값',
      });
    }

    const hasNotice = dto.notice_type !== NoticeTypeEnum.NONE;

    const pitch = await this.prisma.pitch.create({
      data: {
        userId,
        title: dto.title,
        pitchType: dto.pitch_type,
        durationMinutes: dto.duration_minutes,
        hasNotice,
        noticeType: dto.notice_type,
        status: 'SETUP',
      },
    });

    return {
      pitch_id: pitch.id,
      title: pitch.title,
      pitch_type: pitch.pitchType,
      duration_minutes: pitch.durationMinutes,
      status: pitch.status,
      progress_percentage: 0,
      has_notice: pitch.hasNotice,
      notice_type: pitch.noticeType ?? 'NONE',
      ir_template_key: IR_TEMPLATE_MAP[pitch.pitchType] ?? 'VC_STANDARD',
      next_step: nextStep(pitch.noticeType ?? 'NONE'),
      created_at: pitch.createdAt.toISOString(),
    };
  }

  async findAll(
    userId: string,
    query: ListPitchesDto,
  ): Promise<{
    pitches: {
      pitch_id: string;
      title: string;
      pitch_type: string;
      pitch_type_display: string;
      status: 'IN_PROGRESS' | 'COMPLETED';
      application_period: string | null;
      created_at: string;
      updated_at: string;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where = {
      userId,
      isDeleted: false,
      ...(search
        ? {
            title: {
              contains: search,
            },
          }
        : {}),
      ...(query.status === PitchListStatusEnum.COMPLETED
        ? { status: 'COMPLETED' as const }
        : {}),
      ...(query.status === PitchListStatusEnum.IN_PROGRESS
        ? { status: { not: 'COMPLETED' as const } }
        : {}),
    };

    const [total, pitches] = await Promise.all([
      this.prisma.pitch.count({ where }),
      this.prisma.pitch.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          notices: {
            where: { isLatest: true },
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              applicationPeriod: true,
            },
          },
        },
      }),
    ]);

    const items = pitches.map((pitch) => ({
      pitch_id: pitch.id,
      title: pitch.title,
      pitch_type: pitch.pitchType,
      pitch_type_display: mapPitchTypeDisplay(pitch.pitchType),
      status: mapPitchStatus(pitch.status),
      application_period: pitch.notices[0]?.applicationPeriod ?? null,
      created_at: pitch.createdAt.toISOString(),
      updated_at: pitch.updatedAt.toISOString(),
    }));

    return {
      pitches: items,
      total,
      page,
      limit,
    };
  }

  async updateStatus(
    userId: string,
    pitchId: string,
    dto: UpdatePitchStatusDto,
  ): Promise<{
    pitch_id: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    updated_at: string;
  }> {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      select: {
        id: true,
        userId: true,
        isDeleted: true,
        status: true,
      },
    });

    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({ error: 'PITCH_NOT_FOUND' });
    }
    if (pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'UNAUTHORIZED' });
    }

    if (
      dto.status !== UpdatePitchStatusEnum.IN_PROGRESS &&
      dto.status !== UpdatePitchStatusEnum.COMPLETED
    ) {
      throw new BadRequestException({ error: 'INVALID_STATUS' });
    }

    let nextStatus = pitch.status;
    if (dto.status === UpdatePitchStatusEnum.COMPLETED) {
      nextStatus = 'COMPLETED';
    } else if (pitch.status === 'COMPLETED') {
      nextStatus = 'REHEARSAL';
    }

    const updated = await this.prisma.pitch.update({
      where: { id: pitchId },
      data: { status: nextStatus },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      pitch_id: updated.id,
      status: mapPitchStatus(updated.status),
      updated_at: updated.updatedAt.toISOString(),
    };
  }

  async softDelete(
    userId: string,
    pitchId: string,
  ): Promise<{
    pitch_id: string;
    is_deleted: boolean;
    deleted_at: string;
  }> {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      select: {
        id: true,
        userId: true,
        isDeleted: true,
      },
    });

    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({ error: 'PITCH_NOT_FOUND' });
    }
    if (pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'UNAUTHORIZED' });
    }

    const deletedAt = new Date();
    const deleted = await this.prisma.pitch.update({
      where: { id: pitchId },
      data: {
        isDeleted: true,
        deletedAt,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    return {
      pitch_id: deleted.id,
      is_deleted: true,
      deleted_at: deleted.deletedAt?.toISOString() ?? deletedAt.toISOString(),
    };
  }
}
