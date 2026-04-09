import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QAModeEnum, SetQAModeDto } from './dto/set-qa-mode.dto';
import { SetQAModeResponseDto } from './dto/set-qa-mode.response.dto';

type QAQuestionDraft = {
  category: string;
  question: string;
  answerGuide: string;
  displayOrder: number;
};

function safeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function shortenText(value: string | null | undefined, maxLength = 70): string {
  const text = compactText(value);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  private mapQATrainingResponse(
    training: {
      pitchId: string;
      id: string;
      noticeId: string | null;
      irDeckId: string | null;
      voiceAnalysisId: string | null;
      mode: string;
      totalQuestions: number;
      version: number;
      isLatest: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    questions: Array<{
      id: string;
      category: string;
      displayOrder: number;
      question: string;
      answerGuide: string;
    }>,
  ): SetQAModeResponseDto {
    return {
      pitch_id: training.pitchId,
      qa_training: {
        qa_training_id: training.id,
        notice_id: training.noticeId,
        ir_deck_id: training.irDeckId,
        voice_analysis_id: training.voiceAnalysisId,
        mode: training.mode,
        total_questions: training.totalQuestions,
        version: training.version,
        is_latest: training.isLatest,
        created_at: training.createdAt.toISOString(),
        updated_at: training.updatedAt.toISOString(),
      },
      questions: questions.map((question) => ({
        question_id: question.id,
        category: question.category,
        display_order: question.displayOrder,
        question: question.question,
        answer_guide: question.answerGuide,
      })),
    };
  }

  private buildQuestionsFromContext(params: {
    notice?: {
      noticeName: string;
      hostOrganization: string | null;
      recruitmentType: string | null;
      targetAudience: string | null;
      applicationPeriod: string | null;
      summary: string | null;
      coreRequirements: string | null;
      additionalCriteria: string | null;
      irDeckGuide: string | null;
      evaluationCriteria: Array<{
        criteriaName: string;
        pitchcoachInterpretation: string | null;
        irGuide: string | null;
      }>;
    } | null;
    irDeck?: {
      totalScore: number | null;
      presentationGuide: string | null;
      emphasizedSlides: string | null;
      improvedItems: string | null;
      slides: Array<{
        slideNumber: number;
        category: string | null;
        contentSummary: string | null;
      }>;
      deckScore?: {
        structureSummary: string | null;
        strengths: string | null;
        improvements: string | null;
      } | null;
    } | null;
  }): QAQuestionDraft[] {
    const questions: QAQuestionDraft[] = [];
    const seenQuestions = new Set<string>();

    const addQuestion = (draft: QAQuestionDraft) => {
      const question = compactText(draft.question);
      const answerGuide = compactText(draft.answerGuide);

      if (!question || !answerGuide) return;
      if (seenQuestions.has(question)) return;

      seenQuestions.add(question);
      questions.push({
        ...draft,
        question,
        answerGuide,
      });
    };

    const criteriaRows = params.notice?.evaluationCriteria ?? [];
    for (const criteria of criteriaRows) {
      addQuestion({
        category: criteria.criteriaName,
        displayOrder: questions.length + 1,
        question: `${criteria.criteriaName} 항목에서 핵심 근거를 어떻게 설명하시겠습니까?`,
        answerGuide:
          criteria.irGuide ??
          criteria.pitchcoachInterpretation ??
          `${criteria.criteriaName} 관련 근거를 제시하세요.`,
      });
    }

    const notice = params.notice;
    if (notice) {
      const noticeFields: Array<{
        category: string;
        label: string;
        value: string | null;
        guide: string;
      }> = [
        {
          category: 'NOTICE',
          label: '공고명',
          value: notice.noticeName,
          guide: '공고명과 사업 목적의 연결성을 설명하세요.',
        },
        {
          category: 'NOTICE',
          label: '핵심 요구사항',
          value: notice.coreRequirements,
          guide: '핵심 요구사항을 어떻게 충족하는지 근거를 제시하세요.',
        },
        {
          category: 'NOTICE',
          label: '타깃 대상',
          value: notice.targetAudience,
          guide: '타깃 대상의 문제와 우선순위를 설명하세요.',
        },
        {
          category: 'NOTICE',
          label: '추가 조건',
          value: notice.additionalCriteria,
          guide: '추가 조건을 사업 실행 계획에 어떻게 반영했는지 설명하세요.',
        },
        {
          category: 'NOTICE',
          label: 'IR Deck 가이드',
          value: notice.irDeckGuide,
          guide: '공고의 IR Deck 가이드를 발표 내용에 어떻게 반영했는지 설명하세요.',
        },
        {
          category: 'NOTICE',
          label: '요약',
          value: notice.summary,
          guide: '공고 요약의 핵심 포인트를 어떻게 검증했는지 설명하세요.',
        },
        {
          category: 'NOTICE',
          label: '신청 기간',
          value: notice.applicationPeriod,
          guide: '일정 제약을 고려한 준비 계획을 설명하세요.',
        },
      ];

      for (const field of noticeFields) {
        addQuestion({
          category: field.category,
          displayOrder: questions.length + 1,
          question: field.value
            ? `${field.label} "${shortenText(field.value)}"와 관련해 어떤 대응 전략을 세웠나요?`
            : `${field.label} 기준을 어떤 방식으로 검토하고 있나요?`,
          answerGuide: field.guide,
        });
      }
    }

    const irDeck = params.irDeck;
    if (irDeck) {
      const improvedItems = safeJsonArray(irDeck.deckScore?.improvements);
      const strengths = safeJsonArray(irDeck.deckScore?.strengths);
      const slides = irDeck.slides;

      const deckFieldQuestions: Array<{
        category: string;
        question: string;
        answerGuide: string;
      }> = [];

      if (irDeck.deckScore?.structureSummary) {
        deckFieldQuestions.push({
          category: 'IR_DECK',
          question: `IR Deck 구조 요약 "${shortenText(irDeck.deckScore.structureSummary)}"를 발표에서 어떻게 설명하시겠습니까?`,
          answerGuide: 'Deck 구조와 핵심 메시지의 연결성을 설명하세요.',
        });
      }

      for (const item of improvedItems.slice(0, 2)) {
        deckFieldQuestions.push({
          category: 'IR_DECK',
          question: `개선 항목 "${shortenText(item)}"는 어떻게 보완하실 계획인가요?`,
          answerGuide: `개선 항목 "${compactText(item)}"에 대한 실행 계획과 근거를 설명하세요.`,
        });
      }

      for (const item of strengths.slice(0, 1)) {
        deckFieldQuestions.push({
          category: 'IR_DECK',
          question: `강점으로 정리된 "${shortenText(item)}"는 심사위원에게 어떤 설득 포인트가 되나요?`,
          answerGuide: `강점 "${compactText(item)}"가 실질적으로 유효한 이유를 설명하세요.`,
        });
      }

      for (const slide of slides.slice(0, 3)) {
        deckFieldQuestions.push({
          category: slide.category || 'SLIDE',
          question: `슬라이드 ${slide.slideNumber}${slide.category ? ` (${slide.category})` : ''}의 "${shortenText(slide.contentSummary)}"는 어떤 의미를 담고 있나요?`,
          answerGuide: '해당 슬라이드의 핵심 메시지와 근거를 설명하세요.',
        });
      }

      for (const draft of deckFieldQuestions) {
        addQuestion({
          category: draft.category,
          displayOrder: questions.length + 1,
          question: draft.question,
          answerGuide: draft.answerGuide,
        });
      }

      if (irDeck.presentationGuide) {
        addQuestion({
          category: 'IR_DECK',
          displayOrder: questions.length + 1,
          question: `발표 가이드 "${shortenText(irDeck.presentationGuide)}"를 실제 발표 흐름에 어떻게 반영하나요?`,
          answerGuide: '발표 흐름과 질문 대응 전략을 함께 설명하세요.',
        });
      }

      if (irDeck.emphasizedSlides) {
        addQuestion({
          category: 'IR_DECK',
          displayOrder: questions.length + 1,
          question: `중요 슬라이드로 정리된 "${shortenText(irDeck.emphasizedSlides)}"는 왜 강조되었나요?`,
          answerGuide: '강조 슬라이드의 역할과 심사 포인트를 설명하세요.',
        });
      }

      if (irDeck.totalScore != null) {
        addQuestion({
          category: 'IR_DECK',
          displayOrder: questions.length + 1,
          question: `IR Deck 총점 ${irDeck.totalScore}점을 기준으로 가장 먼저 보완할 부분은 무엇인가요?`,
          answerGuide: '현재 점수의 한계와 개선 우선순위를 설명하세요.',
        });
      }
    }

    return questions.slice(0, 5).map((question, index) => ({
      ...question,
      displayOrder: index + 1,
    }));
  }

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

    if (!Object.values(QAModeEnum).includes(dto.qa_mode)) {
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

    const [latestRehearsal, latestNotice, latestIrDeck] = await Promise.all([
      this.prisma.rehearsal.findFirst({
        where: {
          pitchId,
          isLatest: true,
        },
        select: {
          id: true,
          analysisStatus: true,
        },
      }),
      this.prisma.notice.findFirst({
        where: {
          pitchId,
          isLatest: true,
        },
        include: {
          evaluationCriteria: {
            orderBy: {
              displayOrder: 'asc',
            },
            select: {
              criteriaName: true,
              pitchcoachInterpretation: true,
              irGuide: true,
            },
          },
        },
      }),
      this.prisma.iRDeck.findFirst({
        where: {
          pitchId,
          isLatest: true,
        },
        include: {
          deckScore: true,
          slides: {
            orderBy: {
              slideNumber: 'asc',
            },
            select: {
              slideNumber: true,
              category: true,
              contentSummary: true,
            },
          },
        },
      }),
    ]);

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
      if (existingQATraining.mode !== dto.qa_mode) {
        await this.prisma.qATraining.updateMany({
          where: {
            pitchId,
            isLatest: true,
          },
          data: {
            mode: dto.qa_mode,
          },
        });
      }

      return this.mapQATrainingResponse(
        {
          ...existingQATraining,
          mode: dto.qa_mode,
        },
        existingQATraining.questions,
      );
    }

    const questions = this.buildQuestionsFromContext({
      notice: latestNotice
        ? {
            noticeName: latestNotice.noticeName,
            hostOrganization: latestNotice.hostOrganization,
            recruitmentType: latestNotice.recruitmentType,
            targetAudience: latestNotice.targetAudience,
            applicationPeriod: latestNotice.applicationPeriod,
            summary: latestNotice.summary,
            coreRequirements: latestNotice.coreRequirements,
            additionalCriteria: latestNotice.additionalCriteria,
            irDeckGuide: latestNotice.irDeckGuide,
            evaluationCriteria: latestNotice.evaluationCriteria.map((criteria) => ({
              criteriaName: criteria.criteriaName,
              pitchcoachInterpretation: criteria.pitchcoachInterpretation,
              irGuide: criteria.irGuide,
            })),
          }
        : null,
      irDeck: latestIrDeck
        ? {
            totalScore: latestIrDeck.totalScore,
            presentationGuide: latestIrDeck.presentationGuide,
            emphasizedSlides: latestIrDeck.emphasizedSlides,
            improvedItems: latestIrDeck.improvedItems,
            slides: latestIrDeck.slides.map((slide) => ({
              slideNumber: slide.slideNumber,
              category: slide.category,
              contentSummary: slide.contentSummary,
            })),
            deckScore: latestIrDeck.deckScore
              ? {
                  structureSummary: latestIrDeck.deckScore.structureSummary,
                  strengths: latestIrDeck.deckScore.strengths,
                  improvements: latestIrDeck.deckScore.improvements,
                }
              : null,
          }
        : null,
    });

    const createdQATraining = await this.prisma.$transaction(async (tx) => {
      const latestTraining = await tx.qATraining.findFirst({
        where: { pitchId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      await tx.qATraining.updateMany({
        where: {
          pitchId,
          isLatest: true,
        },
        data: {
          isLatest: false,
        },
      });

      return tx.qATraining.create({
        data: {
          pitchId,
          rehearsalId: latestRehearsal.id,
          noticeId: latestNotice?.id ?? null,
          irDeckId: latestIrDeck?.id ?? null,
          voiceAnalysisId: latestRehearsal.id,
          mode: dto.qa_mode,
          totalQuestions: questions.length,
          version: (latestTraining?.version ?? 0) + 1,
          isLatest: true,
          questions: {
            create: questions,
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
    });

    return this.mapQATrainingResponse(createdQATraining, createdQATraining.questions);
  }
}
