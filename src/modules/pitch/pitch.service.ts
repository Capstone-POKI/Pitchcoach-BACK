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

  async setQAMode(
    userId: string,
    pitchId: string,
    dto: { qa_mode: string; force_regenerate?: boolean },
  ): Promise<any> {
    // 1. Pitch 존재 여부 확인
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      select: {
        id: true,
        userId: true,
        isDeleted: true,
      },
    });

    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({
        error: 'PITCH_NOT_FOUND',
        message: '해당 pitch를 찾을 수 없습니다.',
      });
    }

    if (pitch.userId !== userId) {
      throw new ForbiddenException({
        error: 'UNAUTHORIZED',
        message: '인증이 필요합니다.',
      });
    }

    // 2. qa_mode 유효성 검사
    const validModes = ['REALTIME', 'GUIDE_ONLY'];
    if (!validModes.includes(dto.qa_mode)) {
      throw new BadRequestException({
        error: 'INVALID_QA_MODE',
        message: 'qa_mode는 REALTIME 또는 GUIDE_ONLY 이어야 합니다.',
      });
    }

    // 3. force_regenerate 유효성 검사
    if (
      dto.force_regenerate !== undefined &&
      typeof dto.force_regenerate !== 'boolean'
    ) {
      throw new BadRequestException({
        error: 'INVALID_REQUEST',
        message: 'force_regenerate는 boolean 값이어야 합니다.',
      });
    }

    const forceRegenerate = dto.force_regenerate ?? false;

    // 4. 기존 QATraining 확인
    const existingQATraining = await this.prisma.qATraining.findFirst({
      where: {
        pitchId,
        isLatest: true,
      },
      include: {
        questions: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
    });

    // force_regenerate가 false이고 기존 QATraining이 있으면 기존 것 반환
    if (existingQATraining && !forceRegenerate) {
      return {
        pitch_id: pitchId,
        qa_training: {
          qa_training_id: existingQATraining.id,
          notice_id: existingQATraining.noticeId,
          ir_deck_id: existingQATraining.irDeckId,
          voice_analysis_id: existingQATraining.voiceAnalysisId,
          mode: existingQATraining.mode,
          total_questions: existingQATraining.totalQuestions,
          version: existingQATraining.version,
          is_latest: existingQATraining.isLatest,
          created_at: existingQATraining.createdAt.toISOString(),
          updated_at: existingQATraining.updatedAt.toISOString(),
        },
        questions: existingQATraining.questions.map((q) => ({
          question_id: q.id,
          category: q.category,
          display_order: q.displayOrder,
          question: q.question,
          answer_guide: q.answerGuide,
        })),
      };
    }

    // 5. 기존 QATraining이 있으면 isLatest를 false로 업데이트
    if (existingQATraining) {
      await this.prisma.qATraining.update({
        where: { id: existingQATraining.id },
        data: { isLatest: false },
      });
    }

    // 6. 새 QATraining 생성
    const newVersion = (existingQATraining?.version ?? 0) + 1;

    // Mock 질문 데이터 (실제로는 LLM이나 AI 서비스에서 생성)
    const mockQuestions = [
      {
        category: 'PROBLEM',
        displayOrder: 1,
        question:
          '현재 고객이 겪는 가장 큰 문제는 무엇이며, 왜 반드시 해결되어야 하나요?',
        answerGuide:
          '문제의 구체적 상황, 빈도, 기존 대안의 한계를 함께 설명하세요.',
      },
      {
        category: 'SOLUTION',
        displayOrder: 2,
        question:
          '귀사의 솔루션은 기존 방식과 어떻게 다르며 어떤 핵심 가치를 제공하나요?',
        answerGuide:
          '차별화 포인트와 사용자 관점의 효익을 함께 제시하세요.',
      },
      {
        category: 'MARKET_BIZ',
        displayOrder: 3,
        question:
          '시장 규모와 고객 확보 전략은 어떻게 설정하고 있나요?',
        answerGuide:
          '시장 규모 근거와 초기 타깃 고객 전략을 수치 중심으로 설명하세요.',
      },
      {
        category: 'TEAM',
        displayOrder: 4,
        question:
          '현재 팀이 이 사업을 가장 잘 실행할 수 있는 이유는 무엇인가요?',
        answerGuide:
          '핵심 팀원의 경험, 역할 분담, 실행력을 중심으로 답변하세요.',
      },
      {
        category: 'FUNDING',
        displayOrder: 5,
        question:
          '이번 자금을 확보하면 우선적으로 어디에 사용할 계획인가요?',
        answerGuide:
          '자금 사용 우선순위와 기대 효과를 구체적으로 설명하세요.',
      },
    ];

    // 7. 트랜잭션으로 QATraining과 QAQuestion 생성
    const createdQATraining = await this.prisma.qATraining.create({
      data: {
        pitchId,
        mode: dto.qa_mode,
        totalQuestions: mockQuestions.length,
        version: newVersion,
        isLatest: true,
        questions: {
          create: mockQuestions,
        },
      },
      include: {
        questions: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
    });

    // 8. 응답 구성
    return {
      pitch_id: pitchId,
      qa_training: {
        qa_training_id: createdQATraining.id,
        notice_id: createdQATraining.noticeId,
        ir_deck_id: createdQATraining.irDeckId,
        voice_analysis_id: createdQATraining.voiceAnalysisId,
        mode: createdQATraining.mode,
        total_questions: createdQATraining.totalQuestions,
        version: createdQATraining.version,
        is_latest: createdQATraining.isLatest,
        created_at: createdQATraining.createdAt.toISOString(),
        updated_at: createdQATraining.updatedAt.toISOString(),
      },
      questions: createdQATraining.questions.map((q) => ({
        question_id: q.id,
        category: q.category,
        display_order: q.displayOrder,
        question: q.question,
        answer_guide: q.answerGuide,
      })),
    };
  }
}
