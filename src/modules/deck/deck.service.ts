import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  FastApiClient,
  AiIrSummaryResponse,
  AiIrSlidesResponse,
} from '../../infra/fastapi/fastapi.client';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function safeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeStringList(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
    if (typeof parsed === 'string') {
      return parsed
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // fall through to plain string parsing
  }

  return value
    .split(/\r?\n|[•·▪*-]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type CanonicalIrAxis =
  | '문제정의'
  | '솔루션'
  | '시장/비즈니스'
  | '실적'
  | '팀'
  | '자금 계획';

@Injectable()
export class DeckService {
  private readonly logger = new Logger(DeckService.name);

  constructor(
    private prisma: PrismaService,
    private fastApiClient: FastApiClient,
  ) {}

  private mapPitchTypeForAi(pitchType: string): string {
    if (pitchType === 'GOVERNMENT') return 'GOV_SUPPORT';
    if (pitchType === 'COMPETITION') return 'STARTUP_CONTEST';
    return 'VC_DEMO';
  }

  private async buildIrStrategy(
    pitchId: string,
    pitchType: string,
    durationMinutes: number,
    noticeId?: string | null,
  ): Promise<Record<string, unknown> | null> {
    const effectiveNoticeId =
      noticeId ??
      (
        await this.prisma.notice.findFirst({
          where: { pitchId, isLatest: true },
          select: { id: true },
        })
      )?.id ??
      null;

    if (!effectiveNoticeId) {
      return null;
    }

    const [notice, criteriaRows] = await Promise.all([
      this.prisma.notice.findUnique({
        where: { id: effectiveNoticeId },
        select: {
          coreRequirements: true,
          recruitmentType: true,
        },
      }),
      this.prisma.noticeEvaluationCriteria.findMany({
        where: { noticeId: effectiveNoticeId },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    if (criteriaRows.length === 0) {
      return null;
    }

    const normalizedCriteria = this.normalizeNoticeCriteriaToIrAxes(
      criteriaRows.map((row) => ({
        criteriaName: row.criteriaName,
        points: row.points ?? 0,
        pitchcoachInterpretation: row.pitchcoachInterpretation ?? '',
        irGuide: row.irGuide ?? '',
      })),
    );

    return {
      type: this.mapPitchTypeForAi(pitchType),
      focus_point:
        notice?.coreRequirements ?? `${pitchType} 평가 기준 기반 IR 분석`,
      presentation_minutes: durationMinutes,
      required_sections: ['problem', 'solution', 'market', 'team'],
      killer_question: null,
      source: 'notice_evaluation_criteria',
      recruitment_type: notice?.recruitmentType ?? null,
      evaluation_criteria: normalizedCriteria.map((row) => ({
        criteria_name: row.criteria_name,
        points: row.points,
        pitchcoach_interpretation: row.pitchcoach_interpretation,
        ir_guide: row.ir_guide,
      })),
    };
  }

  private async buildCriteriaWeights(
    noticeId?: string | null,
  ): Promise<Record<string, number>> {
    if (!noticeId) return {};
    const rows = await this.prisma.noticeEvaluationCriteria.findMany({
      where: { noticeId },
      orderBy: { displayOrder: 'asc' },
      select: {
        criteriaName: true,
        points: true,
        pitchcoachInterpretation: true,
        irGuide: true,
      },
    });
    const normalizedRows = this.normalizeNoticeCriteriaToIrAxes(
      rows.map((row) => ({
        criteriaName: row.criteriaName,
        points: row.points ?? 0,
        pitchcoachInterpretation: row.pitchcoachInterpretation ?? '',
        irGuide: row.irGuide ?? '',
      })),
    );
    const total = normalizedRows.reduce((sum, row) => sum + row.points, 0);
    if (normalizedRows.length === 0 || total <= 0) return {};
    return Object.fromEntries(
      normalizedRows.map((row) => [
        row.criteria_name,
        Number((row.points / total).toFixed(4)),
      ]),
    );
  }

  private normalizeNoticeCriteriaToIrAxes(
    rows: Array<{
      criteriaName: string;
      points: number;
      pitchcoachInterpretation: string;
      irGuide: string;
    }>,
  ): Array<{
    criteria_name: CanonicalIrAxis;
    points: number;
    pitchcoach_interpretation: string;
    ir_guide: string;
  }> {
    const order: CanonicalIrAxis[] = [
      '문제정의',
      '솔루션',
      '시장/비즈니스',
      '실적',
      '팀',
      '자금 계획',
    ];
    const buckets = new Map<
      CanonicalIrAxis,
      {
        points: number;
        pitchcoach_interpretation: string[];
        ir_guide: string[];
      }
    >();

    for (const row of rows) {
      const axis = this.mapNoticeCriterionToIrAxis(
        row.criteriaName,
        row.pitchcoachInterpretation,
        row.irGuide,
      );
      const current = buckets.get(axis) ?? {
        points: 0,
        pitchcoach_interpretation: [],
        ir_guide: [],
      };
      current.points += row.points ?? 0;
      if (row.pitchcoachInterpretation) {
        current.pitchcoach_interpretation.push(row.pitchcoachInterpretation);
      }
      if (row.irGuide) {
        current.ir_guide.push(row.irGuide);
      }
      buckets.set(axis, current);
    }

    return order
      .filter((axis) => (buckets.get(axis)?.points ?? 0) > 0)
      .map((axis) => {
        const bucket = buckets.get(axis)!;
        return {
          criteria_name: axis,
          points: bucket.points,
          pitchcoach_interpretation: bucket.pitchcoach_interpretation[0] ?? '',
          ir_guide: bucket.ir_guide[0] ?? '',
        };
      });
  }

  private mapNoticeCriterionToIrAxis(
    criteriaName: string,
    interpretation: string,
    guide: string,
  ): CanonicalIrAxis {
    const text = `${criteriaName} ${interpretation} ${guide}`.replace(/\s+/g, '').toLowerCase();

    if (
      text.includes('팀') ||
      text.includes('인력') ||
      text.includes('대표') ||
      text.includes('역량')
    ) {
      return '팀';
    }
    if (
      text.includes('자금') ||
      text.includes('예산') ||
      text.includes('재무') ||
      text.includes('로드맵') ||
      text.includes('마일스톤')
    ) {
      return '자금 계획';
    }
    if (
      text.includes('실적') ||
      text.includes('성장') ||
      text.includes('트랙션') ||
      text.includes('검증') ||
      text.includes('시장반응')
    ) {
      return '실적';
    }
    if (
      text.includes('시장') ||
      text.includes('사업성') ||
      text.includes('수익') ||
      text.includes('bm') ||
      text.includes('비즈니스')
    ) {
      return '시장/비즈니스';
    }
    if (
      text.includes('차별') ||
      text.includes('기술') ||
      text.includes('솔루션') ||
      text.includes('혁신')
    ) {
      return '솔루션';
    }
    return '문제정의';
  }

  // ──────────────────────────────────────────
  // POST /api/pitches/:pitchId/ir-decks/analyze
  // ──────────────────────────────────────────
  async uploadAndAnalyze(
    pitchId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
    });
    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({
        error: 'PITCH_NOT_FOUND',
        message: '존재하지 않는 피칭입니다',
      });
    }
    if (pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    if (
      !file.originalname.toLowerCase().endsWith('.pdf') &&
      file.mimetype !== 'application/pdf'
    ) {
      throw new BadRequestException({
        error: 'INVALID_FILE',
        message: 'PDF 파일만 업로드 가능합니다',
      });
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        error: 'FILE_TOO_LARGE',
        message: '파일 크기는 100MB 이하여야 합니다',
      });
    }

    // 기존 latest 내림
    await this.prisma.iRDeck.updateMany({
      where: { pitchId, isLatest: true },
      data: { isLatest: false },
    });

    // 다음 버전 계산
    const latest = await this.prisma.iRDeck.findFirst({
      where: { pitchId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // 최신 Notice 참조
    const latestNotice = await this.prisma.notice.findFirst({
      where: { pitchId, isLatest: true },
      select: { id: true },
    });
    const strategy = await this.buildIrStrategy(
      pitchId,
      pitch.pitchType,
      pitch.durationMinutes,
      latestNotice?.id ?? null,
    );

    // Deck row 생성
    const irDeck = await this.prisma.iRDeck.create({
      data: {
        pitchId,
        noticeId: latestNotice?.id ?? null,
        pdfSizeBytes: file.size,
        pdfUploadStatus: 'PROCESSING',
        analysisStatus: 'IN_PROGRESS',
        version: nextVersion,
        isLatest: true,
      },
    });

    // Pitch 상태 갱신
    await this.prisma.pitch.update({
      where: { id: pitchId },
      data: { status: 'IRDECK_ANALYSIS' },
    });

    // AI 비동기 호출
    this.fireAiAnalysis(
      irDeck.id,
      pitchId,
      file,
      strategy,
      this.mapPitchTypeForAi(pitch.pitchType),
    );

    return {
      ir_deck_id: irDeck.id,
      pitch_id: pitchId,
      analysis_status: 'IN_PROGRESS' as const,
      version: nextVersion,
      message: 'IR Deck 분석이 시작되었습니다.',
    };
  }

  // ──────────────────────────────────────────
  // GET /api/ir-decks/:deckId
  // ──────────────────────────────────────────
  async getIrDeckResult(deckId: string, userId: string) {
    const irDeck = await this.prisma.iRDeck.findUnique({
      where: { id: deckId },
      include: {
        pitch: { select: { userId: true } },
        deckScore: { include: { criteriaScores: true } },
      },
    });

    if (!irDeck) {
      throw new NotFoundException({ error: 'IR_DECK_NOT_FOUND' });
    }
    if (irDeck.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    // IN_PROGRESS → AI polling 시도
    if (irDeck.analysisStatus === 'IN_PROGRESS') {
      const synced = await this.syncFromAi(irDeck);
      if (synced) {
        return this.getIrDeckResult(deckId, userId);
      }
      return {
        ir_deck_id: irDeck.id,
        pitch_id: irDeck.pitchId,
        analysis_status: 'IN_PROGRESS' as const,
        version: irDeck.version,
      };
    }

    // FAILED
    if (irDeck.analysisStatus === 'FAILED') {
      return {
        ir_deck_id: irDeck.id,
        pitch_id: irDeck.pitchId,
        analysis_status: 'FAILED' as const,
        error_message:
          irDeck.errorMessage ?? 'IR Deck 분석 중 오류가 발생했습니다.',
        version: irDeck.version,
      };
    }

    // COMPLETED → DB 기준 응답
    const ds = irDeck.deckScore;
    const criteriaWeights = await this.buildCriteriaWeights(irDeck.noticeId);

    return {
      ir_deck_id: irDeck.id,
      pitch_id: irDeck.pitchId,
      analysis_status: 'COMPLETED' as const,
      version: irDeck.version,
      deck_score: {
        total_score: ds?.totalScore ?? 0,
        max_score: 100,
        scoring_method: 'weighted_average',
        criteria_weights: criteriaWeights,
        structure_summary: ds?.structureSummary ?? '',
        strengths: safeJsonArray(ds?.strengths),
        improvements: safeJsonArray(ds?.improvements),
      },
      criteria_scores: (ds?.criteriaScores ?? []).map((c) => ({
        criteria_name: c.criteriaName,
        pitchcoach_interpretation:
          c.pitchcoachInterpretation ??
          `${c.criteriaName} 항목을 평가합니다.`,
        ir_guide:
          c.irGuide ?? `${c.criteriaName} 관련 근거를 제시하세요.`,
        score: c.score,
        max_score: 100,
        raw_score: undefined,
        raw_max_score: undefined,
        coverage_status: undefined,
        evidence_slides: safeJsonArray(c.relatedSlides).map((v) => Number(v)).filter((v) => Number.isInteger(v)),
        feedback: c.feedback ?? '',
      })),
      presentation_guide: {
        emphasized_slides: safeJsonParse<
          { slide_number: number; reason: string }[]
        >(irDeck.emphasizedSlides, []),
        guide: safeJsonParse<string[]>(irDeck.presentationGuide, []),
        time_allocation: safeJsonParse<string[]>(irDeck.timeAllocation, []),
      },
      analyzed_at: irDeck.analyzedAt?.toISOString() ?? null,
    };
  }

  // ──────────────────────────────────────────
  // GET /api/ir-decks/:deckId/slides
  // ──────────────────────────────────────────
  async getIrDeckSlides(deckId: string, userId: string) {
    const irDeck = await this.prisma.iRDeck.findUnique({
      where: { id: deckId },
      include: {
        pitch: { select: { userId: true } },
        slides: {
          include: { feedback: true },
          orderBy: { slideNumber: 'asc' },
        },
      },
    });

    if (!irDeck) {
      throw new NotFoundException({
        error: 'IR_DECK_NOT_FOUND',
        message: '존재하지 않는 IR Deck입니다',
      });
    }
    if (irDeck.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    // IN_PROGRESS → sync 시도
    if (irDeck.analysisStatus === 'IN_PROGRESS') {
      const synced = await this.syncFromAi(irDeck);
      if (synced) {
        return this.getIrDeckSlides(deckId, userId);
      }
      return {
        ir_deck_id: irDeck.id,
        analysis_status: 'IN_PROGRESS' as const,
      };
    }

    if (irDeck.analysisStatus === 'FAILED') {
      throw new NotFoundException({
        error: 'IR_DECK_NOT_FOUND',
        message: '존재하지 않는 IR Deck입니다',
      });
    }

    return {
      ir_deck_id: irDeck.id,
      analysis_status: 'COMPLETED' as const,
      total_slides: irDeck.slides.length,
      slides: irDeck.slides.map((s) => ({
        slide_number: s.slideNumber,
        category: s.category ?? '',
        score: s.score ?? 0,
        thumbnail_url: s.thumbnailUrl ?? null,
        content_summary: s.contentSummary ?? '',
        detailed_feedback: s.feedback?.detailedFeedback ?? '',
        strengths: safeJsonArray(s.feedback?.strengths),
        improvements: safeJsonArray(s.feedback?.improvements),
      })),
    };
  }

  async getIrDeckVersions(pitchId: string, userId: string) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({
        error: 'PITCH_NOT_FOUND',
        message: '존재하지 않는 피칭입니다',
      });
    }
    if (pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    const versions = await this.prisma.iRDeck.findMany({
      where: { pitchId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        isLatest: true,
        totalScore: true,
        pdfUrl: true,
        analysisStatus: true,
        analyzedAt: true,
        _count: {
          select: {
            slides: true,
          },
        },
      },
    });

    if (versions.length === 0) {
      throw new NotFoundException({
        error: 'NO_IR_DECKS',
        message: 'IR Deck 분석 이력이 없습니다.',
      });
    }

    return {
      pitch_id: pitchId,
      total_versions: versions.length,
      versions: versions.map((deck) => ({
        ir_deck_id: deck.id,
        version: deck.version,
        is_latest: deck.isLatest,
        total_score: deck.totalScore,
        total_slides: deck._count.slides,
        pdf_url: deck.pdfUrl,
        analysis_status: deck.analysisStatus,
        analyzed_at: deck.analyzedAt?.toISOString() ?? null,
      })),
    };
  }

  async getIrDeckCompare(deckId: string, userId: string) {
    const currentDeck = await this.prisma.iRDeck.findUnique({
      where: { id: deckId },
      include: {
        pitch: { select: { userId: true } },
        deckScore: { select: { improvements: true } },
        slides: {
          select: {
            slideNumber: true,
            category: true,
            score: true,
          },
          orderBy: { slideNumber: 'asc' },
        },
        _count: {
          select: {
            slides: true,
          },
        },
      },
    });

    if (!currentDeck) {
      throw new NotFoundException({ error: 'IR_DECK_NOT_FOUND' });
    }
    if (currentDeck.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    const previousDeck = await this.prisma.iRDeck.findFirst({
      where: {
        pitchId: currentDeck.pitchId,
        version: { lt: currentDeck.version },
      },
      orderBy: { version: 'desc' },
      include: {
        slides: {
          select: {
            slideNumber: true,
            score: true,
          },
        },
        _count: {
          select: {
            slides: true,
          },
        },
      },
    });

    const previousSlideScoreMap = new Map(
      (previousDeck?.slides ?? []).map((slide) => [
        slide.slideNumber,
        slide.score,
      ]),
    );
    const improvedItems = safeStringList(currentDeck.improvedItems);

    return {
      current: {
        ir_deck_id: currentDeck.id,
        version: currentDeck.version,
        total_score: currentDeck.totalScore,
        total_slides: currentDeck._count.slides,
        analyzed_at: currentDeck.analyzedAt?.toISOString() ?? null,
      },
      previous: previousDeck
        ? {
            ir_deck_id: previousDeck.id,
            version: previousDeck.version,
            total_score: previousDeck.totalScore,
            total_slides: previousDeck._count.slides,
            analyzed_at: previousDeck.analyzedAt?.toISOString() ?? null,
          }
        : null,
      score_diff:
        previousDeck &&
        currentDeck.totalScore !== null &&
        previousDeck.totalScore !== null
          ? currentDeck.totalScore - previousDeck.totalScore
          : null,
      slide_comparisons: previousDeck
        ? currentDeck.slides.map((slide) => {
            const previousScore = previousSlideScoreMap.has(slide.slideNumber)
              ? (previousSlideScoreMap.get(slide.slideNumber) ?? null)
              : null;
            const currentScore = slide.score ?? 0;

            return {
              slide_number: slide.slideNumber,
              category: slide.category ?? '',
              current_score: currentScore,
              previous_score: previousScore,
              diff:
                previousScore === null ? null : currentScore - previousScore,
            };
          })
        : [],
      improved_items:
        improvedItems.length > 0
          ? improvedItems
          : safeStringList(currentDeck.deckScore?.improvements),
    };
  }

  // ──────────────────────────────────────────
  // Private: AI 비동기 호출
  // ──────────────────────────────────────────
  private fireAiAnalysis(
    irDeckId: string,
    pitchId: string,
    file: Express.Multer.File,
    strategy?: Record<string, unknown> | null,
    pitchType?: string | null,
  ) {
    this.fastApiClient
      .uploadIrDeckAndAnalyze(
        pitchId,
        file.buffer,
        file.originalname,
        strategy,
        pitchType,
      )
      .then((aiResult) =>
        this.prisma.iRDeck.update({
          where: { id: irDeckId },
          data: { pdfUrl: `ai://${aiResult.ir_deck_id}` },
        }),
      )
      .catch((err: Error) => {
        this.logger.error(`AI 서버 호출 실패: ${err.message}`);
        this.prisma.iRDeck
          .update({
            where: { id: irDeckId },
            data: {
              analysisStatus: 'FAILED',
              pdfUploadStatus: 'FAILED',
              errorMessage: `AI 서버 호출 실패: ${err.message}`,
            },
          })
          .catch((e: Error) =>
            this.logger.error(`DB 상태 갱신 실패: ${e.message}`),
          );
      });
  }

  // ──────────────────────────────────────────
  // Private: AI 결과 동기화
  // ──────────────────────────────────────────
  private async syncFromAi(irDeck: {
    id: string;
    pitchId: string;
    pdfUrl: string | null;
    noticeId: string | null;
  }): Promise<boolean> {
    if (!irDeck.pdfUrl?.startsWith('ai://')) return false;

    const aiId = irDeck.pdfUrl.replace('ai://', '');

    try {
      const summary: AiIrSummaryResponse =
        await this.fastApiClient.getIrDeckResult(aiId);

      if (summary.analysis_status === 'COMPLETED') {
        let slidesRes: AiIrSlidesResponse | null = null;
        try {
          slidesRes = await this.fastApiClient.getIrDeckSlides(aiId);
        } catch {
          this.logger.warn('AI slides 조회 실패, summary만 동기화');
        }

        await this.prisma.$transaction(async (tx) => {
          const ds = summary.deck_score!;
          const pg = summary.presentation_guide!;

          // 1. Deck 본체 갱신
          await tx.iRDeck.update({
            where: { id: irDeck.id },
            data: {
              totalScore: ds.total_score,
              presentationGuide: JSON.stringify(pg.guide),
              timeAllocation: JSON.stringify(pg.time_allocation),
              emphasizedSlides: JSON.stringify(pg.emphasized_slides),
              improvedItems: JSON.stringify(ds.improvements ?? []),
              analysisStatus: 'COMPLETED',
              pdfUploadStatus: 'COMPLETED',
              analyzedAt: summary.analyzed_at
                ? new Date(summary.analyzed_at)
                : new Date(),
              errorMessage: null,
            },
          });

          // 2. DeckScore upsert
          const deckScore = await tx.deckScore.upsert({
            where: { irDeckId: irDeck.id },
            create: {
              irDeckId: irDeck.id,
              totalScore: ds.total_score,
              structureSummary: ds.structure_summary,
              strengths: JSON.stringify(ds.strengths),
              improvements: JSON.stringify(ds.improvements),
            },
            update: {
              totalScore: ds.total_score,
              structureSummary: ds.structure_summary,
              strengths: JSON.stringify(ds.strengths),
              improvements: JSON.stringify(ds.improvements),
            },
          });

          // 3. CriteriaScore 재생성
          await tx.criteriaScore.deleteMany({
            where: { deckScoreId: deckScore.id },
          });

          // Notice 평가기준과 매칭
          let criteriaIdMap: Record<string, string> = {};
          if (irDeck.noticeId) {
            const noticeCriteria =
              await tx.noticeEvaluationCriteria.findMany({
                where: { noticeId: irDeck.noticeId },
              });
            criteriaIdMap = Object.fromEntries(
              noticeCriteria.map((c) => [c.criteriaName, c.id]),
            );
          }

          const criteriaScores = summary.criteria_scores ?? [];
          if (criteriaScores.length > 0) {
            await tx.criteriaScore.createMany({
              data: criteriaScores.map((c) => ({
                deckScoreId: deckScore.id,
                criteriaId: criteriaIdMap[c.criteria_name] ?? null,
                criteriaName: c.criteria_name,
                pitchcoachInterpretation: c.pitchcoach_interpretation,
                irGuide: c.ir_guide,
                score: c.score,
                maxScore: c.max_score ?? 100,
                isCovered: c.score > 0,
                feedback: c.feedback,
                relatedSlides: JSON.stringify(
                  c.evidence_slides ?? c.related_slides ?? [],
                ),
              })),
            });
          }

          // 4. Slides 재생성
          await tx.slide.deleteMany({ where: { irDeckId: irDeck.id } });

          const slides = slidesRes?.slides ?? [];
          for (const s of slides) {
            const slide = await tx.slide.create({
              data: {
                irDeckId: irDeck.id,
                slideNumber: s.slide_number,
                category: s.category,
                thumbnailUrl: s.thumbnail_url ?? null,
                contentSummary: s.content_summary,
                score: s.score,
              },
            });

            await tx.slideFeedback.create({
              data: {
                slideId: slide.id,
                detailedFeedback: s.detailed_feedback,
                strengths: JSON.stringify(s.strengths),
                improvements: JSON.stringify(s.improvements),
              },
            });
          }

          // 5. Pitch 상태 갱신
          await tx.pitch.update({
            where: { id: irDeck.pitchId },
            data: { status: 'REHEARSAL' },
          });
        });

        return true;
      }

      if (summary.analysis_status === 'FAILED') {
        await this.prisma.iRDeck.update({
          where: { id: irDeck.id },
          data: {
            analysisStatus: 'FAILED',
            pdfUploadStatus: 'FAILED',
            errorMessage:
              summary.error_message ??
              'IR Deck 분석 중 오류가 발생했습니다.',
          },
        });
        return true;
      }
    } catch (err) {
      this.logger.warn(`AI polling 실패: ${(err as Error).message}`);
    }

    return false;
  }
}
