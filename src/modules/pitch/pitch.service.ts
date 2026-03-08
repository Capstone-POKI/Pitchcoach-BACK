import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreatePitchDto, NoticeTypeEnum } from './dto/create-pitch.dto';
import { CreatePitchResponseDto } from './dto/create-pitch.response.dto';

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
}
