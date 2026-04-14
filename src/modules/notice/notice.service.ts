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
  AiNoticeResultResponse,
} from '../../infra/fastapi/fastapi.client';
import { UpdateNoticeDto } from './dto/update-notice.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface NoticeEvalCriteriaPayload {
  criteria_name: string;
  points: number;
  pitchcoach_interpretation: string;
  ir_guide: string;
}

interface NoticeResultPayload {
  notice_id: string;
  pitch_id: string;
  analysis_status: string;
  notice_name?: string | null;
  host_organization?: string | null;
  recruitment_type?: string | null;
  target_audience?: string | null;
  application_period?: string | null;
  evaluation_criteria?: NoticeEvalCriteriaPayload[];
  additional_criteria?: string | null;
  ir_deck_guide?: string | null;
  error_message?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface CriteriaTemplate {
  name: string;
  points: number;
  interpretation: string;
  irGuide: string;
}

/* eslint-disable prettier/prettier */
const GOV_CRITERIA: CriteriaTemplate[] = [
  { name: '문제정의', points: 20, interpretation: '사회·산업 문제의 구체성과 검증 근거를 평가합니다.', irGuide: '문제 규모와 수혜대상, 검증 데이터(인터뷰/설문)를 포함하세요.' },
  { name: '솔루션', points: 15, interpretation: '해결책의 실현 가능성과 차별성을 평가합니다.', irGuide: '핵심 기능과 구현 단계(MVP/실증), 차별점 3가지를 제시하세요.' },
  { name: '시장/비즈니스', points: 15, interpretation: '지속 가능 운영 구조와 시장 타당성을 평가합니다.', irGuide: '시장 추정 근거와 운영 모델(지원 종료 후 자립 방안)을 명시하세요.' },
  { name: '실적', points: 15, interpretation: '현장 검증, 실증 결과, 성장 추세를 평가합니다.', irGuide: '파일럿 결과와 핵심 지표를 시계열로 제시하세요.' },
  { name: '팀', points: 15, interpretation: '공공사업 수행 역량과 팀 구성 적합성을 평가합니다.', irGuide: '역할 분담, 산업 경험, 외부 자문 체계를 보여주세요.' },
  { name: '자금 계획', points: 20, interpretation: '예산 배분과 로드맵 정합성을 평가합니다.', irGuide: '항목별 예산, 분기별 마일스톤, 지원 종료 후 계획을 포함하세요.' },
];

const COMP_CRITERIA: CriteriaTemplate[] = [
  { name: '문제정의', points: 25, interpretation: '문제의 현실성과 임팩트를 평가합니다.', irGuide: '타겟 고객의 불편과 문제 규모를 수치/사례로 제시하세요.' },
  { name: '솔루션', points: 25, interpretation: '아이디어의 창의성과 해결력, 데모 완성도를 평가합니다.', irGuide: '문제-해결 매핑, 핵심 기능 3~5개, 사용 시나리오를 보여주세요.' },
  { name: '시장/비즈니스', points: 20, interpretation: '시장성 및 수익화 가능성을 평가합니다.', irGuide: '시장 크기와 BM(가격/수익 구조)을 명확히 제시하세요.' },
  { name: '실적', points: 10, interpretation: '초기 검증 및 사용자 반응을 평가합니다.', irGuide: '파일럿/설문/사용자 반응 등 검증 근거를 포함하세요.' },
  { name: '팀', points: 10, interpretation: '팀 실행력을 평가합니다.', irGuide: '핵심 인력 역할과 프로젝트 실행 이력을 보여주세요.' },
  { name: '자금 계획', points: 10, interpretation: '자금 사용 계획과 성장 로드맵을 평가합니다.', irGuide: '필요 자금, 사용 우선순위, 1~3년 목표를 제시하세요.' },
];

const DEFAULT_CRITERIA_LIST: CriteriaTemplate[] = [
  { name: '문제정의', points: 15, interpretation: '문제의 구체성과 고객 검증을 평가합니다.', irGuide: '고객 페르소나, 문제 규모, 기존 한계를 포함하세요.' },
  { name: '솔루션', points: 20, interpretation: '해결책의 명확성과 차별화를 평가합니다.', irGuide: '차별점 3가지, 핵심 기능, MVP 단계를 제시하세요.' },
  { name: '시장/비즈니스', points: 25, interpretation: '시장 규모와 수익 모델 타당성을 평가합니다.', irGuide: 'TAM/SAM/SOM, 가격 정책, 수익 계산식을 포함하세요.' },
  { name: '실적', points: 20, interpretation: '트랙션과 성장 속도를 평가합니다.', irGuide: 'MAU/매출/전환율 등 핵심 지표를 제시하세요.' },
  { name: '팀', points: 10, interpretation: '팀의 실행 역량을 평가합니다.', irGuide: '핵심 멤버 경력과 역할 분담을 명확히 하세요.' },
  { name: '자금 계획', points: 10, interpretation: '자금 사용 계획과 마일스톤 정합성을 평가합니다.', irGuide: '투자/지원금 배분과 BEP/로드맵을 제시하세요.' },
];
/* eslint-enable prettier/prettier */

const CRITERIA_MAP: Record<string, CriteriaTemplate[]> = {
  GOVERNMENT: GOV_CRITERIA,
  COMPETITION: COMP_CRITERIA,
};

function computeImportance(points: number | null): string | null {
  if (points == null) return null;
  if (points >= 30) return 'HIGH';
  if (points >= 15) return 'MEDIUM';
  return 'LOW';
}

function getDefaultCriteria(pitchType: string) {
  return CRITERIA_MAP[pitchType] ?? DEFAULT_CRITERIA_LIST;
}

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    private prisma: PrismaService,
    private fastApiClient: FastApiClient,
  ) {}

  // POST /api/pitches/:pitchId/notices/analyze
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
        message: '파일 크기는 10MB 이하여야 합니다',
      });
    }

    await this.prisma.notice.updateMany({
      where: { pitchId, isLatest: true },
      data: { isLatest: false },
    });

    const latest = await this.prisma.notice.findFirst({
      where: { pitchId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const notice = await this.prisma.notice.create({
      data: {
        pitchId,
        noticeName: '',
        pdfSizeBytes: file.size,
        pdfUploadStatus: 'PROCESSING',
        analysisStatus: 'IN_PROGRESS',
        version: nextVersion,
        isLatest: true,
      },
    });

    await this.prisma.pitch.update({
      where: { id: pitchId },
      data: {
        status: 'NOTICE_ANALYSIS',
        hasNotice: true,
        noticeType: 'PDF',
      },
    });

    const defaults = getDefaultCriteria(pitch.pitchType);
    await this.prisma.noticeEvaluationCriteria.createMany({
      data: defaults.map((c, i) => ({
        noticeId: notice.id,
        criteriaName: c.name,
        points: c.points,
        importance: computeImportance(c.points),
        displayOrder: i + 1,
        pitchcoachInterpretation: c.interpretation,
        irGuide: c.irGuide,
      })),
    });

    this.fireAiAnalysis(notice.id, pitchId, file);

    return {
      notice_id: notice.id,
      pitch_id: pitchId,
      analysis_status: 'IN_PROGRESS' as const,
      message: '공고문 분석이 시작되었습니다.',
    };
  }

  // GET /api/notices/:noticeId
  async getNoticeResult(
    noticeId: string,
    userId: string,
  ): Promise<NoticeResultPayload> {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
      include: {
        pitch: {
          select: { userId: true, pitchType: true },
        },
        evaluationCriteria: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException({
        error: 'NOTICE_NOT_FOUND',
      });
    }
    if (notice.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'UNAUTHORIZED' });
    }

    if (notice.analysisStatus === 'IN_PROGRESS') {
      const synced = await this.syncFromAi(notice);
      if (synced) {
        return this.getNoticeResult(noticeId, userId);
      }
      return {
        notice_id: notice.id,
        pitch_id: notice.pitchId,
        analysis_status: 'IN_PROGRESS' as const,
        updated_at: notice.updatedAt,
      };
    }

    if (notice.analysisStatus === 'FAILED') {
      return {
        notice_id: notice.id,
        pitch_id: notice.pitchId,
        analysis_status: 'FAILED' as const,
        error_message: notice.errorMessage ?? '분석 중 오류가 발생했습니다.',
        updated_at: notice.updatedAt,
      };
    }

    let criteria = notice.evaluationCriteria;
    if (criteria.length === 0) {
      const defaults = getDefaultCriteria(notice.pitch.pitchType);
      await this.prisma.noticeEvaluationCriteria.createMany({
        data: defaults.map((c, i) => ({
          noticeId: notice.id,
          criteriaName: c.name,
          points: c.points,
          importance: computeImportance(c.points),
          displayOrder: i + 1,
          pitchcoachInterpretation: c.interpretation,
          irGuide: c.irGuide,
        })),
      });
      criteria = await this.prisma.noticeEvaluationCriteria.findMany({
        where: { noticeId: notice.id },
        orderBy: { displayOrder: 'asc' },
      });
    }

    return {
      notice_id: notice.id,
      pitch_id: notice.pitchId,
      analysis_status: 'COMPLETED' as const,
      notice_name: notice.noticeName || null,
      host_organization: notice.hostOrganization,
      recruitment_type: notice.recruitmentType,
      target_audience: notice.targetAudience,
      application_period: notice.applicationPeriod,
      evaluation_criteria: criteria.map((c) => ({
        criteria_name: c.criteriaName,
        points: c.points ?? 0,
        pitchcoach_interpretation:
          c.pitchcoachInterpretation ?? `${c.criteriaName} 항목을 평가합니다.`,
        ir_guide: c.irGuide ?? `${c.criteriaName} 관련 근거를 제시하세요.`,
      })),
      additional_criteria: notice.additionalCriteria,
      ir_deck_guide: notice.irDeckGuide,
      created_at: notice.createdAt,
      updated_at: notice.updatedAt,
    };
  }

  // PATCH /api/notices/:noticeId
  async updateNotice(
    noticeId: string,
    userId: string,
    dto: UpdateNoticeDto,
  ): Promise<NoticeResultPayload> {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
      include: {
        pitch: {
          select: { userId: true, pitchType: true },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException({
        error: 'NOTICE_NOT_FOUND',
      });
    }
    if (notice.pitch.userId !== userId) {
      throw new ForbiddenException({ error: 'UNAUTHORIZED' });
    }

    if (dto.evaluation_criteria !== undefined) {
      if (dto.evaluation_criteria.length === 0) {
        throw new BadRequestException({
          error: 'INVALID_REQUEST',
          message: '심사 기준은 1개 이상 필수',
        });
      }
      const sum = dto.evaluation_criteria.reduce((acc, c) => acc + c.points, 0);
      if (sum !== 100) {
        throw new BadRequestException({
          error: 'POINTS_SUM_INVALID',
          message: '배점 합계는 100이어야 합니다',
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.notice_name !== undefined) updateData.noticeName = dto.notice_name;
    if (dto.host_organization !== undefined)
      updateData.hostOrganization = dto.host_organization;
    if (dto.recruitment_type !== undefined)
      updateData.recruitmentType = dto.recruitment_type;
    if (dto.target_audience !== undefined)
      updateData.targetAudience = dto.target_audience;
    if (dto.application_period !== undefined)
      updateData.applicationPeriod = dto.application_period;
    if (dto.additional_criteria !== undefined)
      updateData.additionalCriteria = dto.additional_criteria;

    updateData.analysisStatus = 'COMPLETED';

    await this.prisma.notice.update({
      where: { id: noticeId },
      data: updateData,
    });

    if (dto.evaluation_criteria !== undefined) {
      await this.prisma.noticeEvaluationCriteria.deleteMany({
        where: { noticeId },
      });

      const templates = getDefaultCriteria(notice.pitch.pitchType);

      await this.prisma.noticeEvaluationCriteria.createMany({
        data: dto.evaluation_criteria.map((c, i) => {
          const t = templates.find((tpl) => tpl.name === c.criteria_name);
          return {
            noticeId,
            criteriaName: c.criteria_name,
            points: c.points,
            importance: computeImportance(c.points),
            displayOrder: i + 1,
            pitchcoachInterpretation:
              t?.interpretation ??
              `${c.criteria_name} 항목을 중심으로 평가합니다.`,
            irGuide:
              t?.irGuide ??
              `${c.criteria_name} 관련 근거와 실행 계획을 슬라이드에 포함하세요.`,
          };
        }),
      });

      this.regenerateInterpretations(noticeId, dto);
    }

    return this.getNoticeResult(noticeId, userId);
  }

  // ── private helpers ──

  private fireAiAnalysis(
    noticeId: string,
    pitchId: string,
    file: Express.Multer.File,
  ) {
    this.fastApiClient
      .uploadNoticeAndAnalyze(pitchId, file.buffer, file.originalname)
      .then((aiResult) =>
        this.prisma.notice.update({
          where: { id: noticeId },
          data: {
            pdfUrl: aiResult.notice_id ? `ai://${aiResult.notice_id}` : null,
          },
        }),
      )
      .catch((err: Error) => {
        this.logger.error(`AI 서버 호출 실패: ${err.message}`);
        this.prisma.notice
          .update({
            where: { id: noticeId },
            data: {
              analysisStatus: 'FAILED',
              pdfUploadStatus: 'FAILED',
              errorMessage: `AI 서버 연결 실패: ${err.message}`,
            },
          })
          .catch((dbErr: Error) =>
            this.logger.error(`notice FAILED 업데이트 실패: ${dbErr.message}`),
          );
      });
  }

  private async syncFromAi(notice: {
    id: string;
    pitchId: string;
    pdfUrl: string | null;
  }): Promise<boolean> {
    if (!notice.pdfUrl?.startsWith('ai://')) return false;

    const aiId = notice.pdfUrl.replace('ai://', '');

    try {
      const r: AiNoticeResultResponse =
        await this.fastApiClient.getNoticeResult(aiId);

      if (r.analysis_status === 'COMPLETED') {
        await this.prisma.notice.update({
          where: { id: notice.id },
          data: {
            noticeName: r.notice_name ?? '',
            hostOrganization: r.host_organization ?? null,
            recruitmentType: r.recruitment_type ?? null,
            targetAudience: r.target_audience ?? null,
            applicationPeriod: r.application_period ?? null,
            additionalCriteria: r.additional_criteria ?? null,
            irDeckGuide: r.ir_deck_guide ?? null,
            analysisStatus: 'COMPLETED',
            pdfUploadStatus: 'COMPLETED',
            errorMessage: null,
          },
        });

        if (r.evaluation_criteria && r.evaluation_criteria.length > 0) {
          await this.prisma.noticeEvaluationCriteria.deleteMany({
            where: { noticeId: notice.id },
          });
          await this.prisma.noticeEvaluationCriteria.createMany({
            data: r.evaluation_criteria.map((c, i) => ({
              noticeId: notice.id,
              criteriaName: c.criteria_name,
              points: c.points,
              importance: computeImportance(c.points),
              displayOrder: i + 1,
              pitchcoachInterpretation: c.pitchcoach_interpretation,
              irGuide: c.ir_guide,
            })),
          });
        }

        await this.prisma.pitch.update({
          where: { id: notice.pitchId },
          data: { status: 'IRDECK_ANALYSIS' },
        });

        return true;
      }

      if (r.analysis_status === 'FAILED') {
        await this.prisma.notice.update({
          where: { id: notice.id },
          data: {
            analysisStatus: 'FAILED',
            pdfUploadStatus: 'FAILED',
            errorMessage: r.error_message ?? '분석 중 오류가 발생했습니다.',
          },
        });
        return true;
      }
    } catch (err) {
      this.logger.warn(`AI polling 실패: ${(err as Error).message}`);
    }

    return false;
  }

  private regenerateInterpretations(noticeId: string, dto: UpdateNoticeDto) {
    this.prisma.notice
      .findUnique({ where: { id: noticeId } })
      .then(async (notice) => {
        if (!notice?.pdfUrl?.startsWith('ai://')) return;

        const aiId = notice.pdfUrl.replace('ai://', '');
        const aiResult: AiNoticeResultResponse =
          await this.fastApiClient.updateNotice(aiId, {
            notice_name: dto.notice_name,
            host_organization: dto.host_organization,
            recruitment_type: dto.recruitment_type,
            target_audience: dto.target_audience,
            application_period: dto.application_period,
            evaluation_criteria: dto.evaluation_criteria,
            additional_criteria: dto.additional_criteria,
          });

        if (
          aiResult.evaluation_criteria &&
          aiResult.evaluation_criteria.length > 0
        ) {
          const existing = await this.prisma.noticeEvaluationCriteria.findMany({
            where: { noticeId },
            orderBy: { displayOrder: 'asc' },
          });

          for (const ac of aiResult.evaluation_criteria) {
            const match = existing.find(
              (e) => e.criteriaName === ac.criteria_name,
            );
            if (match) {
              await this.prisma.noticeEvaluationCriteria.update({
                where: { id: match.id },
                data: {
                  pitchcoachInterpretation: ac.pitchcoach_interpretation,
                  irGuide: ac.ir_guide,
                },
              });
            }
          }
        }

        if (aiResult.ir_deck_guide) {
          await this.prisma.notice.update({
            where: { id: noticeId },
            data: {
              irDeckGuide: aiResult.ir_deck_guide,
            },
          });
        }
      })
      .catch((err: Error) => {
        this.logger.warn(`AI 해석 재생성 실패: ${err.message}`);
      });
  }
}
