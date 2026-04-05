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
  AiVoiceAnalyzeContext,
  AiVoiceAnalyzeOptions,
} from '../../infra/fastapi/fastapi.client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMETYPES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/ogg',
  'video/webm',
]);
const ALLOWED_EXTENSIONS = new Set(['.webm', '.mp3', '.m4a', '.wav', '.ogg', '.mp4']);
const MAX_REHEARSAL_VERSIONS = 6;

// In-memory map: rehearsalId → AI voice_id
const aiVoiceIdMap = new Map<string, string>();

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
    // Fall through to plain string parsing.
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function mapPitchTypeForAi(pitchType: string): string {
  if (pitchType === 'ELEVATOR') return 'ELEVATOR';
  if (pitchType === 'GOVERNMENT') return 'GOVERNMENT';
  if (pitchType === 'COMPETITION') return 'COMPETITION';
  return 'VC_DEMO';
}

type SlideTimestamp = {
  slide_number: number;
  start_timestamp: number;
  end_timestamp: number;
};

@Injectable()
export class RehearsalService {
  private readonly logger = new Logger(RehearsalService.name);

  constructor(
    private prisma: PrismaService,
    private fastApiClient: FastApiClient,
  ) {}

  private async buildVoiceAnalyzeContext(
    pitchId: string,
    fallbackPitchType: string,
    irDeckId: string,
  ): Promise<AiVoiceAnalyzeContext> {
    const [pitch, irDeck, latestNotice] = await Promise.all([
      this.prisma.pitch.findUnique({
        where: { id: pitchId },
        select: {
          id: true,
          pitchType: true,
          durationMinutes: true,
        },
      }),
      this.prisma.iRDeck.findUnique({
        where: { id: irDeckId },
        include: {
          deckScore: {
            include: {
              criteriaScores: true,
            },
          },
          slides: {
            orderBy: { slideNumber: 'asc' },
          },
        },
      }),
      this.prisma.notice.findFirst({
        where: { pitchId, isLatest: true },
        include: {
          evaluationCriteria: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      }),
    ]);

    if (!pitch || !irDeck) {
      throw new NotFoundException({
        error: 'IR_DECK_NOT_FOUND',
        message: 'IR Deck이 없습니다. IR Deck 분석을 먼저 완료해주세요.',
      });
    }

    return {
      pitch: {
        pitch_id: pitch.id,
        pitch_type: mapPitchTypeForAi(pitch.pitchType || fallbackPitchType),
        duration_minutes: pitch.durationMinutes ?? null,
      },
      notice: latestNotice
        ? {
            notice_id: latestNotice.id,
            notice_name: latestNotice.noticeName ?? null,
            recruitment_type: latestNotice.recruitmentType ?? null,
            target_audience: latestNotice.targetAudience ?? null,
            application_period: latestNotice.applicationPeriod ?? null,
            additional_criteria: latestNotice.additionalCriteria ?? null,
            ir_deck_guide: latestNotice.irDeckGuide ?? null,
            evaluation_criteria: latestNotice.evaluationCriteria.map((c) => ({
              criteria_name: c.criteriaName,
              points: c.points ?? undefined,
              pitchcoach_interpretation:
                c.pitchcoachInterpretation ?? undefined,
              ir_guide: c.irGuide ?? undefined,
            })),
          }
        : null,
      ir_deck: {
        ir_deck_id: irDeck.id,
        version: irDeck.version,
        deck_score: irDeck.deckScore
          ? {
              total_score: irDeck.deckScore.totalScore,
              structure_summary: irDeck.deckScore.structureSummary ?? '',
              strengths: safeJsonArray(irDeck.deckScore.strengths),
              improvements: safeJsonArray(irDeck.deckScore.improvements),
            }
          : undefined,
        criteria_scores: (irDeck.deckScore?.criteriaScores ?? []).map((c) => ({
          criteria_name: c.criteriaName,
          pitchcoach_interpretation:
            c.pitchcoachInterpretation ?? undefined,
          ir_guide: c.irGuide ?? undefined,
          score: c.score,
          feedback: c.feedback ?? undefined,
          related_slides: safeJsonArray(c.relatedSlides)
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v)),
        })),
        presentation_guide: {
          emphasized_slides: safeJsonParse<
            { slide_number: number; reason: string }[]
          >(irDeck.emphasizedSlides, []),
          guide: safeJsonParse<string[]>(irDeck.presentationGuide, []),
          time_allocation: safeJsonParse<string[]>(irDeck.timeAllocation, []),
        },
        slides: irDeck.slides.map((slide) => ({
          slide_number: slide.slideNumber,
          category: slide.category ?? '',
          content_summary: slide.contentSummary ?? '',
        })),
      },
    };
  }

  // ──────────────────────────────────────────
  // POST /api/pitches/:pitchId/rehearsals
  // POST /api/pitches/:pitchId/voice/upload-and-analyze
  // ──────────────────────────────────────────
  async uploadAndAnalyze(
    pitchId: string,
    userId: string,
    file: Express.Multer.File,
    slideTimestampsRaw?: string,
  ) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
    });
    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({ error: 'PITCH_NOT_FOUND' });
    }
    if (pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    const ext = '.' + (file.originalname.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException({
        error: 'INVALID_FILE',
        message: '지원하지 않는 음성 파일 형식입니다',
      });
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        error: 'FILE_TOO_LARGE',
        message: '파일 크기는 50MB 이하여야 합니다',
      });
    }

    // Parse slide timestamps
    let slideTimestamps: SlideTimestamp[] | undefined;
    if (slideTimestampsRaw) {
      try {
        const parsed = JSON.parse(slideTimestampsRaw);
        if (!Array.isArray(parsed)) {
          throw new Error('not array');
        }
        slideTimestamps = parsed as SlideTimestamp[];
      } catch {
        throw new BadRequestException({
          error: 'INVALID_TIMESTAMPS',
          message: '슬라이드 타임스탬프가 유효하지 않습니다',
        });
      }
    }

    // Get latest IR deck
    const latestDeck = await this.prisma.iRDeck.findFirst({
      where: { pitchId, isLatest: true, analysisStatus: 'COMPLETED' },
      select: { id: true },
    });
    if (!latestDeck) {
      throw new NotFoundException({
        error: 'IR_DECK_NOT_FOUND',
        message: 'IR Deck이 없습니다. IR Deck 분석을 먼저 완료해주세요.',
      });
    }

    // Mark previous rehearsals as not latest
    await this.prisma.rehearsal.updateMany({
      where: { pitchId, isLatest: true },
      data: { isLatest: false },
    });

    // Auto-increment rehearsal number
    const lastRehearsal = await this.prisma.rehearsal.findFirst({
      where: { pitchId },
      orderBy: { rehearsalNumber: 'desc' },
      select: { rehearsalNumber: true },
    });
    const rehearsalNumber = (lastRehearsal?.rehearsalNumber ?? 0) + 1;

    // Calculate duration if timestamps provided
    let audioDurationSeconds: number | undefined;
    if (slideTimestamps && slideTimestamps.length > 0) {
      const lastTs = slideTimestamps[slideTimestamps.length - 1];
      audioDurationSeconds = Math.round(lastTs.end_timestamp);
    }

    // Create rehearsal record
    const rehearsal = await this.prisma.rehearsal.create({
      data: {
        pitchId,
        irDeckId: latestDeck.id,
        rehearsalNumber,
        isLatest: true,
        audioFileUrl: 'pending',
        audioDurationSeconds: audioDurationSeconds ?? null,
        audioDurationDisplay: audioDurationSeconds ? formatDuration(audioDurationSeconds) : null,
        audioFormat: ext.replace('.', ''),
        analysisStatus: 'IN_PROGRESS',
      },
    });

    // Update pitch status
    await this.prisma.pitch.update({
      where: { id: pitchId },
      data: { status: 'REHEARSAL' },
    });

    const voiceContext = await this.buildVoiceAnalyzeContext(
      pitchId,
      pitch.pitchType,
      latestDeck.id,
    );
    const voiceOptions: AiVoiceAnalyzeOptions = {
      slide_timestamps: slideTimestamps,
    };

    // Fire AI analysis async
    this.fireAiAnalysis(
      rehearsal.id,
      pitchId,
      pitch.pitchType,
      file,
      slideTimestamps,
      voiceContext,
      voiceOptions,
    );

    return {
      voice_analysis_id: rehearsal.id,
      pitch_id: pitchId,
      ir_deck_id: latestDeck.id,
      audio_file_url: null,
      audio_duration_seconds: audioDurationSeconds ?? null,
      audio_format: ext.replace('.', ''),
      analysis_status: 'IN_PROGRESS' as const,
      version: rehearsalNumber,
      is_latest: true,
      message: '음성 분석이 시작되었습니다.',
    };
  }

  // ──────────────────────────────────────────
  // GET /api/rehearsals/:voiceId
  // GET /api/voice/:voiceId
  // ──────────────────────────────────────────
  async getRehearsalResult(rehearsalId: string, userId: string) {
    const rehearsal = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: {
        pitch: { select: { userId: true } },
        detailScores: true,
        deliveryAnalyses: true,
      },
    });

    if (!rehearsal) {
      throw new NotFoundException({ error: 'VOICE_ANALYSIS_NOT_FOUND' });
    }
    if (rehearsal.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    if (rehearsal.analysisStatus === 'IN_PROGRESS') {
      const synced = await this.syncFromAi(rehearsal.id);
      if (synced) {
        return this.getRehearsalResult(rehearsalId, userId);
      }
      return {
        voice_id: rehearsal.id,
        pitch_id: rehearsal.pitchId,
        analysis_status: 'IN_PROGRESS' as const,
        version: rehearsal.rehearsalNumber,
      };
    }

    if (rehearsal.analysisStatus === 'FAILED') {
      return {
        voice_id: rehearsal.id,
        pitch_id: rehearsal.pitchId,
        analysis_status: 'FAILED' as const,
        error_message: rehearsal.errorMessage ?? '음성 분석 중 오류가 발생했습니다.',
        version: rehearsal.rehearsalNumber,
      };
    }

    // COMPLETED
    const detailScores = rehearsal.detailScores.map((d) => ({
      category: d.categoryDisplayName,
      score: d.score,
    }));

    const deliveryItems = rehearsal.deliveryAnalyses
      .filter((d) => d.categoryName !== 'WPM')
      .map((d) => ({
        category: d.categoryDisplayName,
        feedback: d.feedback ?? '',
      }));

    const wpmAnalysis = rehearsal.deliveryAnalyses.find((d) => d.categoryName === 'WPM');

    return {
      voice_id: rehearsal.id,
      pitch_id: rehearsal.pitchId,
      analysis_status: 'COMPLETED' as const,
      version: rehearsal.rehearsalNumber,
      audio_duration_display: rehearsal.audioDurationDisplay ?? '',
      wpm: rehearsal.wpm ?? 0,
      total_score: rehearsal.totalScore ?? 0,
      structure_summary: rehearsal.structureSummary ?? '',
      overall_strengths: safeJsonArray(rehearsal.overallStrengths),
      overall_improvements: safeJsonArray(rehearsal.overallImprovements),
      detail_scores: detailScores,
      delivery_analysis: {
        speaking_speed: {
          metric_value: wpmAnalysis?.metricValue ?? `${rehearsal.wpm ?? 0} WPM`,
          metric_label: wpmAnalysis?.metricLabel ?? '적정',
        },
        items: deliveryItems,
      },
      analyzed_at: rehearsal.analyzedAt?.toISOString() ?? null,
    };
  }

  // ──────────────────────────────────────────
  // GET /api/rehearsals/:voiceId/slides
  // GET /api/voice/:voiceId/slides
  // ──────────────────────────────────────────
  async getRehearsalSlides(rehearsalId: string, userId: string) {
    const rehearsal = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      include: {
        pitch: { select: { userId: true } },
        slideAnalyses: {
          include: { slide: { select: { thumbnailUrl: true } } },
          orderBy: { slideNumber: 'asc' },
        },
      },
    });

    if (!rehearsal) {
      throw new NotFoundException({ error: 'VOICE_ANALYSIS_NOT_FOUND' });
    }
    if (rehearsal.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    if (rehearsal.analysisStatus === 'IN_PROGRESS') {
      const synced = await this.syncFromAi(rehearsal.id);
      if (synced) {
        return this.getRehearsalSlides(rehearsalId, userId);
      }
      return { voice_id: rehearsal.id, analysis_status: 'IN_PROGRESS' as const };
    }

    if (rehearsal.analysisStatus === 'FAILED') {
      throw new NotFoundException({ error: 'VOICE_ANALYSIS_NOT_FOUND' });
    }

    return {
      voice_id: rehearsal.id,
      analysis_status: 'COMPLETED' as const,
      total_slides: rehearsal.slideAnalyses.length,
      slides: rehearsal.slideAnalyses.map((s) => ({
        slide_number: s.slideNumber,
        category: s.category ?? '',
        score: s.score ?? 0,
        thumbnail_url: s.slide?.thumbnailUrl ?? null,
        start_timestamp: s.startTimestamp,
        end_timestamp: s.endTimestamp,
        duration_display: s.durationDisplay ?? '',
        content_summary: s.contentSummary ?? '',
        detailed_feedback: s.detailedFeedback ?? '',
        strengths: safeJsonArray(s.strengths),
        improvements: safeJsonArray(s.improvements),
      })),
    };
  }

  async getRehearsalVersions(pitchId: string, userId: string) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!pitch || pitch.isDeleted) {
      throw new NotFoundException({ error: 'PITCH_NOT_FOUND' });
    }
    if (pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    const totalVersions = await this.prisma.rehearsal.count({
      where: { pitchId },
    });

    if (totalVersions === 0) {
      throw new NotFoundException({
        error: 'NO_VOICE_ANALYSES',
        message: '음성 분석 이력이 없습니다.',
      });
    }

    const versions = await this.prisma.rehearsal.findMany({
      where: { pitchId },
      orderBy: { rehearsalNumber: 'desc' },
      take: MAX_REHEARSAL_VERSIONS,
      select: {
        id: true,
        rehearsalNumber: true,
        isLatest: true,
        totalScore: true,
        wpm: true,
        audioDurationSeconds: true,
        audioDurationDisplay: true,
        audioFileUrl: true,
        analysisStatus: true,
        analyzedAt: true,
      },
    });

    return {
      pitch_id: pitchId,
      total_versions: totalVersions,
      versions: versions.map((version) => ({
        voice_id: version.id,
        version: version.rehearsalNumber,
        is_latest: version.isLatest,
        total_score: version.totalScore,
        wpm: version.wpm,
        audio_duration_seconds: version.audioDurationSeconds,
        audio_duration_display: version.audioDurationDisplay,
        audio_file_url: version.audioFileUrl,
        analysis_status: version.analysisStatus,
        analyzed_at: version.analyzedAt?.toISOString() ?? null,
      })),
    };
  }

  async getRehearsalCompare(voiceId: string, userId: string) {
    const current = await this.prisma.rehearsal.findUnique({
      where: { id: voiceId },
      include: {
        pitch: { select: { userId: true } },
        detailScores: { orderBy: { categoryName: 'asc' } },
        slideAnalyses: { orderBy: { slideNumber: 'asc' } },
      },
    });

    if (!current) {
      throw new NotFoundException({ error: 'VOICE_NOT_FOUND' });
    }
    if (current.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }

    const previous = await this.prisma.rehearsal.findFirst({
      where: {
        pitchId: current.pitchId,
        rehearsalNumber: { lt: current.rehearsalNumber },
      },
      orderBy: { rehearsalNumber: 'desc' },
      include: {
        detailScores: true,
        slideAnalyses: true,
      },
    });

    const previousDetailScoreMap = new Map(
      (previous?.detailScores ?? []).map((score) => [
        score.categoryName,
        score,
      ]),
    );
    const previousSlideScoreMap = new Map(
      (previous?.slideAnalyses ?? []).map((slide) => [
        slide.slideNumber,
        slide.score,
      ]),
    );
    const improvedItems = safeStringList(current.improvedItems);
    const fallbackImprovedItems = safeStringList(current.overallImprovements);

    return {
      current: {
        voice_id: current.id,
        version: current.rehearsalNumber,
        total_score: current.totalScore,
        wpm: current.wpm,
        audio_duration_display: current.audioDurationDisplay,
        analyzed_at: current.analyzedAt?.toISOString() ?? null,
      },
      previous: previous
        ? {
            voice_id: previous.id,
            version: previous.rehearsalNumber,
            total_score: previous.totalScore,
            wpm: previous.wpm,
            audio_duration_display: previous.audioDurationDisplay,
            analyzed_at: previous.analyzedAt?.toISOString() ?? null,
          }
        : null,
      score_diff:
        previous &&
        current.totalScore !== null &&
        previous.totalScore !== null
          ? current.totalScore - previous.totalScore
          : null,
      detail_score_comparisons: previous
        ? current.detailScores.map((score) => {
            const previousScore =
              previousDetailScoreMap.get(score.categoryName) ?? null;
            return {
              category_name: score.categoryName,
              category_display_name: score.categoryDisplayName,
              current_score: score.score,
              previous_score: previousScore?.score ?? null,
              diff:
                previousScore?.score == null
                  ? null
                  : score.score - previousScore.score,
            };
          })
        : [],
      slide_comparisons: previous
        ? current.slideAnalyses.map((slide) => {
            const currentScore = slide.score ?? 0;
            const previousScore = previousSlideScoreMap.has(slide.slideNumber)
              ? (previousSlideScoreMap.get(slide.slideNumber) ?? null)
              : null;
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
        improvedItems.length > 0 ? improvedItems : fallbackImprovedItems,
    };
  }

  // ──────────────────────────────────────────
  // Private: AI 비동기 호출
  // ──────────────────────────────────────────
  private fireAiAnalysis(
    rehearsalId: string,
    pitchId: string,
    pitchType: string,
    file: Express.Multer.File,
    slideTimestamps?: SlideTimestamp[],
    context?: AiVoiceAnalyzeContext,
    options?: AiVoiceAnalyzeOptions,
  ) {
    this.fastApiClient
      .analyzeVoice(
        pitchId,
        file.buffer,
        file.originalname,
        pitchType,
        slideTimestamps,
        context,
        options,
      )
      .then((aiResult) => {
        aiVoiceIdMap.set(rehearsalId, aiResult.voice_id);
        return this.prisma.rehearsal.update({
          where: { id: rehearsalId },
          data: { audioFileUrl: `ai://${aiResult.voice_id}` },
        });
      })
      .catch((err: Error) => {
        this.logger.error(`AI 서버 호출 실패: ${err.message}`);
        this.prisma.rehearsal
          .update({
            where: { id: rehearsalId },
            data: {
              analysisStatus: 'FAILED',
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
  private async syncFromAi(rehearsalId: string): Promise<boolean> {
    const rehearsal = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      select: { id: true, pitchId: true, irDeckId: true, audioFileUrl: true, createdAt: true },
    });
    if (!rehearsal?.audioFileUrl?.startsWith('ai://')) return false;

    const TIMEOUT_MS = Number(process.env.VOICE_ANALYSIS_TIMEOUT_MINUTES ?? 10) * 60 * 1000;
    if (Date.now() - rehearsal.createdAt.getTime() > TIMEOUT_MS) {
      await this.prisma.rehearsal.update({
        where: { id: rehearsalId },
        data: { analysisStatus: 'FAILED', errorMessage: '음성 분석 시간이 초과되었습니다.' },
      });
      return true;
    }

    const aiVoiceId = rehearsal.audioFileUrl.replace('ai://', '');

    try {
      const voiceResult = await this.fastApiClient.getVoiceResult(aiVoiceId) as Record<string, unknown>;
      const status = voiceResult.analysis_status as string;

      if (status === 'COMPLETED') {
        let slidesResult: Record<string, unknown> | null = null;
        try {
          slidesResult = await this.fastApiClient.getVoiceSlides(aiVoiceId) as Record<string, unknown>;
        } catch {
          this.logger.warn('AI slides 조회 실패, 전체 결과만 동기화');
        }

        await this.saveCompletedResult(rehearsal.id, rehearsal.pitchId, rehearsal.irDeckId, voiceResult, slidesResult);
        return true;
      }

      if (status === 'FAILED') {
        await this.prisma.rehearsal.update({
          where: { id: rehearsalId },
          data: {
            analysisStatus: 'FAILED',
            errorMessage: (voiceResult.error_message as string) ?? '음성 분석 중 오류가 발생했습니다.',
          },
        });
        return true;
      }
    } catch (err) {
      this.logger.warn(`AI polling 실패: ${(err as Error).message}`);
    }

    return false;
  }

  private async saveCompletedResult(
    rehearsalId: string,
    pitchId: string,
    irDeckId: string | null,
    voiceResult: Record<string, unknown>,
    slidesResult: Record<string, unknown> | null,
  ) {
    const wpm = Number(voiceResult.wpm ?? 0);
    const totalScore = Number(voiceResult.total_score ?? 0);
    const structureSummary = String(voiceResult.structure_summary ?? '');
    const overallStrengths = voiceResult.overall_strengths as string[] ?? [];
    const overallImprovements = voiceResult.overall_improvements as string[] ?? [];
    const audioDurationDisplay = String(voiceResult.audio_duration_display ?? '');
    const audioDurationSeconds = voiceResult.duration_seconds != null
      ? Math.round(Number(voiceResult.duration_seconds))
      : undefined;
    const detailScores = voiceResult.detail_scores as Array<{ category: string; score: number }> ?? [];
    const deliveryAnalysis = voiceResult.delivery_analysis as Record<string, unknown> ?? {};
    const speakingSpeed = deliveryAnalysis.speaking_speed as Record<string, string> ?? {};
    const deliveryItems = deliveryAnalysis.items as Array<{ category: string; feedback: string }> ?? [];

    const DETAIL_CATEGORY_MAP: Record<string, string> = {
      '문제 정의': 'PROBLEM_DEFINITION',
      '솔루션 명확성': 'SOLUTION_CLARITY',
      '시장성': 'MARKET',
      '사업성 BM': 'BUSINESS_MODEL',
      '경쟁력 차별성': 'COMPETITIVE_ADVANTAGE',
      '전달력': 'DELIVERY',
      '톤 일관성': 'TONE_CONSISTENCY',
      '시간 적합성': 'TIME_SUITABILITY',
    };

    const DELIVERY_CATEGORY_MAP: Record<string, string> = {
      '억양 강조 안정성': 'INTONATION',
      '감정 톤': 'EMOTION_TONE',
      '문장 명료성': 'CLARITY',
      '불필요한 말버릇': 'FILLER_WORDS',
    };

    await this.prisma.$transaction(async (tx) => {
      // 1. Rehearsal 본체 갱신
      await tx.rehearsal.update({
        where: { id: rehearsalId },
        data: {
          wpm,
          totalScore,
          structureSummary,
          overallStrengths: JSON.stringify(overallStrengths),
          overallImprovements: JSON.stringify(overallImprovements),
          audioDurationDisplay,
          ...(audioDurationSeconds !== undefined && { audioDurationSeconds }),
          analysisStatus: 'COMPLETED',
          analyzedAt: new Date(),
          errorMessage: null,
        },
      });

      // 2. RehearsalDetailScore 생성
      await tx.rehearsalDetailScore.deleteMany({ where: { rehearsalId } });
      if (detailScores.length > 0) {
        await tx.rehearsalDetailScore.createMany({
          data: detailScores.map((d) => ({
            rehearsalId,
            categoryName: DETAIL_CATEGORY_MAP[d.category] ?? d.category,
            categoryDisplayName: d.category,
            score: d.score,
            maxScore: 100,
          })),
        });
      }

      // 3. RehearsalDeliveryAnalysis 생성
      await tx.rehearsalDeliveryAnalysis.deleteMany({ where: { rehearsalId } });
      const deliveryData = [
        {
          categoryName: 'WPM',
          categoryDisplayName: '말하기 속도',
          score: null,
          feedback: null,
          metricValue: speakingSpeed.metric_value ?? `${wpm} WPM`,
          metricLabel: speakingSpeed.metric_label ?? '적정',
        },
        ...deliveryItems.map((d) => ({
          categoryName: DELIVERY_CATEGORY_MAP[d.category] ?? d.category,
          categoryDisplayName: d.category,
          score: null,
          feedback: d.feedback,
          metricValue: null,
          metricLabel: null,
        })),
      ];
      await tx.rehearsalDeliveryAnalysis.createMany({ data: deliveryData.map((d) => ({ rehearsalId, ...d })) });

      // 4. RehearsalSlideAnalysis 생성
      if (slidesResult) {
        const slides = slidesResult.slides as Array<Record<string, unknown>> ?? [];
        await tx.rehearsalSlideAnalysis.deleteMany({ where: { rehearsalId } });

        // Find matching slide IDs from IR deck
        const deckSlides = irDeckId
          ? await tx.slide.findMany({ where: { irDeckId }, select: { id: true, slideNumber: true } })
          : [];
        const slideIdMap = new Map(deckSlides.map((s) => [s.slideNumber, s.id]));

        for (const s of slides) {
          const slideNum = Number(s.slide_number ?? 0);
          const durationSec = Math.round(Number(s.duration_seconds ?? 0));
          const startTs = Number(s.start_timestamp ?? 0);
          const endTs = Number(s.end_timestamp ?? 0);
          await tx.rehearsalSlideAnalysis.create({
            data: {
              rehearsalId,
              slideId: slideIdMap.get(slideNum) ?? null,
              slideNumber: slideNum,
              category: String(s.category ?? ''),
              startTimestamp: startTs,
              endTimestamp: endTs,
              durationSeconds: durationSec,
              durationDisplay: String(s.duration_display ?? ''),
              score: Number(s.score ?? 0),
              contentSummary: String(s.content_summary ?? ''),
              detailedFeedback: String(s.detailed_feedback ?? ''),
              strengths: JSON.stringify(s.strengths ?? []),
              improvements: JSON.stringify(s.improvements ?? []),
            },
          });
        }
      }

      // 5. Pitch 상태 갱신
      await tx.pitch.update({
        where: { id: pitchId },
        data: { status: 'REHEARSAL' },
      });
    });
  }
}
