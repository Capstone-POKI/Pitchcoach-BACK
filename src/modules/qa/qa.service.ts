import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FastApiClient } from '../../infra/fastapi/fastapi.client';
import { GetQAQuestionsResponseDto } from './dto/get-qa-questions.response.dto';
import { QAModeEnum, SetQAModeDto } from './dto/set-qa-mode.dto';
import { SetQAModeResponseDto } from './dto/set-qa-mode.response.dto';

type QAQuestionDraft = {
  category: string;
  question: string;
  answerGuide: string;
  displayOrder: number;
};

type QAQuestionRow = {
  id: string;
  category: string;
  displayOrder: number;
  question: string;
  answerGuide: string;
  answer: { id: string } | null;
};

type QATrainingRow = {
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
};

function safeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
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

function normalizeCategory(category: string): string {
  return compactText(category).replace(/\s+/g, '').toUpperCase();
}

function buildDefaultAnswerGuide(question: string, category: string): string {
  const normalizedCategory = normalizeCategory(category);

  switch (normalizedCategory) {
    case 'PROBLEM':
    case '문제':
    case '문제정의':
      return '문제의 규모, 발생 배경, 기존 대안의 한계, 검증 근거를 함께 설명하세요.';
    case 'SOLUTION':
    case '솔루션':
      return '핵심 해결 방식, 차별점, 구현 단계, 검증 결과를 함께 설명하세요.';
    case 'MARKET_BIZ':
    case 'MARKETBIZ':
    case '시장비즈니스':
    case '시장/비즈니스':
      return '시장 규모, 고객 세분화, 수익 모델, 확장 계획을 수치와 함께 설명하세요.';
    case 'PERFORMANCE':
    case '실적':
      return '실적 지표, 전후 비교, 성장 신호, 재현 가능한 근거를 중심으로 설명하세요.';
    case 'TEAM':
      return '핵심 팀원의 역할, 관련 경험, 실행 체계, 보완 인력을 설명하세요.';
    case 'FUNDING':
    case '자금계획':
    case '자금계획안':
    case '자금':
      return '자금 사용 우선순위, 단계별 집행 계획, 성과 지표, 일정과 연결해 설명하세요.';
    case 'JUDGE_TYPE':
    case '심사유형':
    case '심사위원':
      return '심사위원이 확인하려는 핵심 쟁점을 먼저 정리하고, 결론-근거-사례 순으로 답변하세요.';
    case 'NOTICE':
      return '공고의 핵심 요구사항, 평가 기준, 일정, 제출 조건에 어떻게 대응하는지 설명하세요.';
    case 'IR_DECK':
      return 'Deck의 핵심 메시지, 구조, 개선 포인트, 발표 흐름과의 연결을 설명하세요.';
    case 'SLIDE':
      return '해당 슬라이드의 역할, 핵심 메시지, 근거, 다음 질문에 대한 대비를 설명하세요.';
    default: {
      const topic = shortenText(question.replace(/[?？]/g, ''), 30) || '질문';
      return `${topic}에 대해 답변의 결론, 근거, 수치 또는 사례, 실행 계획을 순서대로 설명하세요.`;
    }
  }
}

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fastApiClient: FastApiClient,
  ) {}

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

  private mapQuestionListResponse(
    training: QATrainingRow,
    questions: QAQuestionRow[],
  ): GetQAQuestionsResponseDto {
    return {
      pitch_id: training.pitchId,
      qa_training: {
        qa_training_id: training.id,
        mode: training.mode,
        total_questions: training.totalQuestions,
        version: training.version,
        is_latest: training.isLatest,
      },
      questions: questions.map((question) => ({
        question_id: question.id,
        category: question.category,
        display_order: question.displayOrder,
        question: question.question,
        answer_guide: question.answerGuide,
        has_answer: Boolean(question.answer),
      })),
      updated_at: training.updatedAt.toISOString(),
    };
  }

  private buildAnswerGuideForQuestion(question: {
    category: string;
    question: string;
  }): string {
    return buildDefaultAnswerGuide(question.question, question.category);
  }

  private async findLatestQATrainingWithQuestions(
    pitchId: string,
  ): Promise<(QATrainingRow & { questions: QAQuestionRow[] }) | null> {
    return this.prisma.qATraining.findFirst({
      where: {
        pitchId,
        isLatest: true,
      },
      include: {
        questions: {
          orderBy: {
            displayOrder: 'asc',
          },
          include: {
            answer: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private buildNoticeContextText(
    notice: {
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
    } | null,
  ): string {
    if (!notice) {
      return '공고 정보 없음';
    }

    const criteriaText = notice.evaluationCriteria
      .map((criteria, index) => {
        const interpretation = compactText(criteria.pitchcoachInterpretation);
        const guide = compactText(criteria.irGuide);
        return [
          `${index + 1}. ${criteria.criteriaName}`,
          interpretation ? `- 해석: ${interpretation}` : null,
          guide ? `- IR 가이드: ${guide}` : null,
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    return [
      notice.noticeName ? `공고명: ${notice.noticeName}` : null,
      notice.hostOrganization ? `주관기관: ${notice.hostOrganization}` : null,
      notice.recruitmentType ? `모집유형: ${notice.recruitmentType}` : null,
      notice.targetAudience ? `대상: ${notice.targetAudience}` : null,
      notice.applicationPeriod ? `신청기간: ${notice.applicationPeriod}` : null,
      notice.summary ? `요약: ${notice.summary}` : null,
      notice.coreRequirements
        ? `핵심요구사항: ${notice.coreRequirements}`
        : null,
      notice.additionalCriteria
        ? `추가조건: ${notice.additionalCriteria}`
        : null,
      notice.irDeckGuide ? `IR Deck 가이드: ${notice.irDeckGuide}` : null,
      criteriaText ? `평가기준:\n${criteriaText}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }

  private buildIrDeckContextText(
    irDeck: {
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
    } | null,
  ): string {
    if (!irDeck) {
      return 'IR Deck 정보 없음';
    }

    const slideSummary = irDeck.slides
      .slice(0, 8)
      .map((slide) => {
        const category = compactText(slide.category);
        const summary = compactText(slide.contentSummary);
        if (!summary) {
          return null;
        }
        return `- 슬라이드 ${slide.slideNumber}${category ? ` (${category})` : ''}: ${summary}`;
      })
      .filter((line): line is string => Boolean(line))
      .join('\n');

    return [
      irDeck.totalScore != null ? `IR Deck 총점: ${irDeck.totalScore}` : null,
      irDeck.deckScore?.structureSummary
        ? `구조 요약: ${irDeck.deckScore.structureSummary}`
        : null,
      irDeck.deckScore?.strengths
        ? `강점: ${safeJsonArray(irDeck.deckScore.strengths).join(', ')}`
        : null,
      irDeck.deckScore?.improvements
        ? `개선점: ${safeJsonArray(irDeck.deckScore.improvements).join(', ')}`
        : null,
      irDeck.presentationGuide
        ? `발표 가이드: ${irDeck.presentationGuide}`
        : null,
      irDeck.emphasizedSlides
        ? `중요 슬라이드: ${irDeck.emphasizedSlides}`
        : null,
      irDeck.improvedItems ? `보완 항목: ${irDeck.improvedItems}` : null,
      slideSummary ? `슬라이드 요약:\n${slideSummary}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }

  private buildPresentationContextText(
    rehearsal: {
      transcription: string | null;
      structureSummary: string | null;
      overallStrengths: string | null;
      overallImprovements: string | null;
      improvedItems: string | null;
    } | null,
  ): string {
    if (!rehearsal) {
      return '발표 분석 정보 없음';
    }

    return [
      rehearsal.structureSummary
        ? `발표 구조 요약: ${rehearsal.structureSummary}`
        : null,
      rehearsal.overallStrengths
        ? `발표 강점: ${rehearsal.overallStrengths}`
        : null,
      rehearsal.overallImprovements
        ? `발표 개선점: ${rehearsal.overallImprovements}`
        : null,
      rehearsal.improvedItems ? `개선 항목: ${rehearsal.improvedItems}` : null,
      rehearsal.transcription
        ? `발표 전사:\n${shortenText(rehearsal.transcription, 4000)}`
        : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }

  private normalizeAiQuestionType(questionType: string): string {
    const normalized = normalizeCategory(questionType);
    if (normalized === 'PITCHBOOK') return 'IR_DECK';
    if (normalized === 'PRESENTER') return 'PRESENTER';
    if (normalized === 'EVALUATOR') return 'EVALUATOR';
    if (normalized === 'NOTICE') return 'NOTICE';
    return compactText(questionType) || 'NOTICE';
  }

  private async generateQuestionsViaAi(params: {
    pitchId: string;
    noticeContent: string;
    irDeckSummary: string;
    presentationContent?: string;
  }): Promise<QAQuestionDraft[] | null> {
    try {
      await this.fastApiClient.generateQaQuestions(
        params.pitchId,
        params.noticeContent,
        params.irDeckSummary,
        params.presentationContent,
      );

      const maxRetries = 10;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await this.fastApiClient.getQaQuestions(
          params.pitchId,
        );
        const aiQuestions = response.questions ?? [];
        if (aiQuestions.length > 0) {
          return aiQuestions
            .map((question, index) => {
              const content = compactText(question.content);
              if (!content) return null;

              const category = this.normalizeAiQuestionType(question.type);
              const guidance = compactText(question.guidance);

              return {
                category,
                question: content,
                answerGuide:
                  guidance || buildDefaultAnswerGuide(content, category),
                displayOrder: index + 1,
              };
            })
            .filter((draft): draft is QAQuestionDraft => Boolean(draft));
        }

        await QaService.sleep(400);
      }

      this.logger.warn(
        `AI Q&A generation returned no questions within retry window (pitchId=${params.pitchId})`,
      );
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `AI Q&A generation failed, fallback to local generator (pitchId=${params.pitchId}): ${message}`,
      );
      return null;
    }
  }

  async getQuestions(
    userId: string,
    pitchId: string,
    regenerateGuides = false,
  ): Promise<GetQAQuestionsResponseDto> {
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

    const latestQATraining =
      await this.findLatestQATrainingWithQuestions(pitchId);

    if (!latestQATraining) {
      throw new NotFoundException({
        error: 'QA_TRAINING_NOT_FOUND',
        message: '최신 Q&A 훈련 정보를 찾을 수 없습니다.',
      });
    }

    const questionsToRefresh = latestQATraining.questions.filter(
      (question) => regenerateGuides || !compactText(question.answerGuide),
    );

    if (questionsToRefresh.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const question of questionsToRefresh) {
          await tx.qAQuestion.update({
            where: { id: question.id },
            data: {
              answerGuide: this.buildAnswerGuideForQuestion(question),
            },
          });
        }

        await tx.qATraining.update({
          where: { id: latestQATraining.id },
          data: {
            mode: latestQATraining.mode,
          },
        });
      });
    }

    const refreshedQATraining =
      questionsToRefresh.length > 0
        ? await this.findLatestQATrainingWithQuestions(pitchId)
        : latestQATraining;

    if (!refreshedQATraining) {
      throw new NotFoundException({
        error: 'QA_TRAINING_NOT_FOUND',
        message: '최신 Q&A 훈련 정보를 찾을 수 없습니다.',
      });
    }

    return this.mapQuestionListResponse(
      refreshedQATraining,
      refreshedQATraining.questions,
    );
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
          guide:
            '공고의 IR Deck 가이드를 발표 내용에 어떻게 반영했는지 설명하세요.',
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
          transcription: true,
          structureSummary: true,
          overallStrengths: true,
          overallImprovements: true,
          improvedItems: true,
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

    const requestedMode = String(dto.qa_mode);

    if (existingQATraining && !forceRegenerate) {
      if (existingQATraining.mode !== requestedMode) {
        await this.prisma.qATraining.updateMany({
          where: {
            pitchId,
            isLatest: true,
          },
          data: {
            mode: requestedMode,
          },
        });
      }

      return this.mapQATrainingResponse(
        {
          ...existingQATraining,
          mode: requestedMode,
        },
        existingQATraining.questions,
      );
    }

    const normalizedNotice = latestNotice
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
          evaluationCriteria: latestNotice.evaluationCriteria.map(
            (criteria) => ({
              criteriaName: criteria.criteriaName,
              pitchcoachInterpretation: criteria.pitchcoachInterpretation,
              irGuide: criteria.irGuide,
            }),
          ),
        }
      : null;

    const normalizedIrDeck = latestIrDeck
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
      : null;

    const questionsFromAi = await this.generateQuestionsViaAi({
      pitchId,
      noticeContent: this.buildNoticeContextText(normalizedNotice),
      irDeckSummary: this.buildIrDeckContextText(normalizedIrDeck),
      presentationContent: this.buildPresentationContextText(
        latestRehearsal
          ? {
              transcription: latestRehearsal.transcription,
              structureSummary: latestRehearsal.structureSummary,
              overallStrengths: latestRehearsal.overallStrengths,
              overallImprovements: latestRehearsal.overallImprovements,
              improvedItems: latestRehearsal.improvedItems,
            }
          : null,
      ),
    });

    const questions =
      questionsFromAi && questionsFromAi.length > 0
        ? questionsFromAi
        : this.buildQuestionsFromContext({
            notice: normalizedNotice,
            irDeck: normalizedIrDeck,
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

    return this.mapQATrainingResponse(
      createdQATraining,
      createdQATraining.questions,
    );
  }
}
