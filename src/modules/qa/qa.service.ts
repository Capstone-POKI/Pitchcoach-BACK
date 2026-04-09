import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SetQAModeDto } from './dto/set-qa-mode.dto';
import { SetQAModeResponseDto } from './dto/set-qa-mode.response.dto';

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  async setQAMode(
    userId: string,
    pitchId: string,
    dto: SetQAModeDto,
  ): Promise<SetQAModeResponseDto> {
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

    if (!["REALTIME", "GUIDE_ONLY"].includes(dto.qa_mode)) {
      throw new BadRequestException({
        error: 'INVALID_QA_MODE',
        message: 'qa_mode는 REALTIME 또는 GUIDE_ONLY 이어야 합니다.',
      });
    }

    if (
      dto.force_regenerate !== undefined &&
      typeof dto.force_regenerate !== 'boolean'
    ) {
      throw new BadRequestException({
        error: 'INVALID_REQUEST',
        message: 'force_regenerate는 boolean 값이어야 합니다.',
      });
    }

    const latestRehearsal = await this.prisma.rehearsal.findFirst({
      where: {
        pitchId,
        isLatest: true,
      },
      select: {
        id: true,
        analysisStatus: true,
      },
    });

    if (!latestRehearsal || latestRehearsal.analysisStatus !== 'COMPLETED') {
      throw new ConflictException({
        error: 'VOICE_ANALYSIS_NOT_COMPLETED',
        message:
          'Q&A 훈련 설정 및 질문 생성은 피칭 음성 분석 완료 후 가능합니다.',
      });
    }

    const forceRegenerate = dto.force_regenerate ?? false;

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

    if (existingQATraining) {
      await this.prisma.qATraining.update({
        where: { id: existingQATraining.id },
        data: { isLatest: false },
      });
    }

    const latestNotice = await this.prisma.notice.findFirst({
      where: {
        pitchId,
        isLatest: true,
      },
      select: { id: true },
    });

    const latestIrDeck = await this.prisma.iRDeck.findFirst({
      where: {
        pitchId,
        isLatest: true,
      },
      select: { id: true },
    });

    const newVersion = (existingQATraining?.version ?? 0) + 1;
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
        answerGuide: '차별화 포인트와 사용자 관점의 효익을 함께 제시하세요.',
      },
      {
        category: 'MARKET_BIZ',
        displayOrder: 3,
        question: '시장 규모와 고객 확보 전략은 어떻게 설정하고 있나요?',
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
        question: '이번 자금을 확보하면 우선적으로 어디에 사용할 계획인가요?',
        answerGuide: '자금 사용 우선순위와 기대 효과를 구체적으로 설명하세요.',
      },
    ];

    const createdQATraining = await this.prisma.qATraining.create({
      data: {
        pitchId,
        rehearsalId: latestRehearsal.id,
        noticeId: latestNotice?.id,
        irDeckId: latestIrDeck?.id,
        voiceAnalysisId: latestRehearsal.id,
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
