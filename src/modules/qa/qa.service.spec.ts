/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QaService } from './qa.service';

type TxRunner = (tx: {
  qAQuestion: { update: UpdateMock };
  qATraining: { update: UpdateMock };
}) => unknown;

type UpdateMock = ReturnType<
  typeof jest.fn<(args: unknown) => Promise<unknown>>
>;
type FindUniqueMock = ReturnType<
  typeof jest.fn<(args: unknown) => Promise<unknown>>
>;
type FindFirstMock = ReturnType<
  typeof jest.fn<(args: unknown) => Promise<unknown>>
>;
type TransactionMock = ReturnType<
  typeof jest.fn<(runner: TxRunner) => Promise<unknown>>
>;

type PrismaMock = {
  pitch: {
    findUnique: FindUniqueMock;
  };
  qATraining: {
    findFirst: FindFirstMock;
    update: UpdateMock;
  };
  qAQuestion: {
    update: UpdateMock;
  };
  $transaction: TransactionMock;
};

type FastApiClientMock = {
  generateQaQuestions: ReturnType<
    typeof jest.fn<
      (
        args: unknown,
        a2?: unknown,
        a3?: unknown,
        a4?: unknown,
      ) => Promise<unknown>
    >
  >;
  getQaQuestions: ReturnType<
    typeof jest.fn<(args: unknown) => Promise<unknown>>
  >;
};

describe('QaService.getQuestions', () => {
  const prisma: PrismaMock = {
    pitch: {
      findUnique: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
    qATraining: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
      update: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
    qAQuestion: {
      update: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
    $transaction: jest.fn<(runner: TxRunner) => Promise<unknown>>(),
  };

  const fastApiClient: FastApiClientMock = {
    generateQaQuestions:
      jest.fn<
        (
          args: unknown,
          a2?: unknown,
          a3?: unknown,
          a4?: unknown,
        ) => Promise<unknown>
      >(),
    getQaQuestions: jest.fn<(args: unknown) => Promise<unknown>>(),
  };

  const service = new QaService(prisma as any, fastApiClient as any);

  const baseTraining = {
    pitchId: 'pitch-1',
    id: 'qa-1',
    noticeId: null,
    irDeckId: null,
    voiceAnalysisId: null,
    mode: 'GUIDE_ONLY',
    totalQuestions: 2,
    version: 1,
    isLatest: true,
    createdAt: new Date('2026-03-12T14:00:00.000Z'),
    updatedAt: new Date('2026-03-12T14:20:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation((runner: TxRunner) =>
      Promise.resolve(
        runner({
          qAQuestion: prisma.qAQuestion,
          qATraining: prisma.qATraining,
        }),
      ),
    );
  });

  it('질문 목록을 조회하고 has_answer를 함께 반환한다', async () => {
    prisma.pitch.findUnique.mockResolvedValue({
      id: 'pitch-1',
      userId: 'user-1',
      isDeleted: false,
    });

    prisma.qATraining.findFirst.mockResolvedValue({
      ...baseTraining,
      questions: [
        {
          id: 'q-1',
          category: 'SOLUTION',
          displayOrder: 1,
          question: '솔루션 차별점은 무엇인가요?',
          answerGuide: '차별화 포인트와 근거를 설명하세요.',
          answer: null,
        },
        {
          id: 'q-2',
          category: 'MARKET_BIZ',
          displayOrder: 2,
          question: '시장 확장 전략은 무엇인가요?',
          answerGuide: '시장 규모와 성장 계획을 설명하세요.',
          answer: { id: 'ans-1' },
        },
      ],
    });

    const result = await service.getQuestions('user-1', 'pitch-1', false);

    expect(result.pitch_id).toBe('pitch-1');
    expect(result.qa_training.qa_training_id).toBe('qa-1');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].has_answer).toBe(false);
    expect(result.questions[1].has_answer).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('비어 있는 answer_guide만 자동 생성 후 저장한다', async () => {
    prisma.pitch.findUnique.mockResolvedValue({
      id: 'pitch-1',
      userId: 'user-1',
      isDeleted: false,
    });

    const firstRead = {
      ...baseTraining,
      updatedAt: new Date('2026-03-12T14:20:00.000Z'),
      questions: [
        {
          id: 'q-1',
          category: 'SOLUTION',
          displayOrder: 1,
          question: '솔루션 차별점은 무엇인가요?',
          answerGuide: '기존 가이드 유지',
          answer: null,
        },
        {
          id: 'q-2',
          category: 'TEAM',
          displayOrder: 2,
          question: '핵심 팀 역량은 무엇인가요?',
          answerGuide: '   ',
          answer: null,
        },
      ],
    };

    const secondRead = {
      ...baseTraining,
      updatedAt: new Date('2026-03-12T14:22:00.000Z'),
      questions: [
        {
          id: 'q-1',
          category: 'SOLUTION',
          displayOrder: 1,
          question: '솔루션 차별점은 무엇인가요?',
          answerGuide: '기존 가이드 유지',
          answer: null,
        },
        {
          id: 'q-2',
          category: 'TEAM',
          displayOrder: 2,
          question: '핵심 팀 역량은 무엇인가요?',
          answerGuide:
            '핵심 팀원의 역할, 관련 경험, 실행 체계, 보완 인력을 설명하세요.',
          answer: null,
        },
      ],
    };

    prisma.qATraining.findFirst
      .mockResolvedValueOnce(firstRead)
      .mockResolvedValueOnce(secondRead);

    const result = await service.getQuestions('user-1', 'pitch-1', false);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.qAQuestion.update).toHaveBeenCalledTimes(1);
    expect(prisma.qAQuestion.update).toHaveBeenCalledWith({
      where: { id: 'q-2' },
      data: {
        answerGuide:
          '핵심 팀원의 역할, 관련 경험, 실행 체계, 보완 인력을 설명하세요.',
      },
    });
    expect(prisma.qATraining.update).toHaveBeenCalledWith({
      where: { id: 'qa-1' },
      data: { mode: 'GUIDE_ONLY' },
    });
    expect(result.questions[1].answer_guide).toContain('핵심 팀원의 역할');
    expect(result.updated_at).toBe('2026-03-12T14:22:00.000Z');
  });

  it('regenerate_guides=true면 모든 가이드를 재생성한다', async () => {
    prisma.pitch.findUnique.mockResolvedValue({
      id: 'pitch-1',
      userId: 'user-1',
      isDeleted: false,
    });

    const firstRead = {
      ...baseTraining,
      questions: [
        {
          id: 'q-1',
          category: 'SOLUTION',
          displayOrder: 1,
          question: '솔루션 차별점은 무엇인가요?',
          answerGuide: 'old-1',
          answer: null,
        },
        {
          id: 'q-2',
          category: 'FUNDING',
          displayOrder: 2,
          question: '자금 계획은 어떻게 되나요?',
          answerGuide: 'old-2',
          answer: null,
        },
      ],
    };

    const secondRead = {
      ...baseTraining,
      questions: [
        {
          id: 'q-1',
          category: 'SOLUTION',
          displayOrder: 1,
          question: '솔루션 차별점은 무엇인가요?',
          answerGuide:
            '핵심 해결 방식, 차별점, 구현 단계, 검증 결과를 함께 설명하세요.',
          answer: null,
        },
        {
          id: 'q-2',
          category: 'FUNDING',
          displayOrder: 2,
          question: '자금 계획은 어떻게 되나요?',
          answerGuide:
            '자금 사용 우선순위, 단계별 집행 계획, 성과 지표, 일정과 연결해 설명하세요.',
          answer: null,
        },
      ],
    };

    prisma.qATraining.findFirst
      .mockResolvedValueOnce(firstRead)
      .mockResolvedValueOnce(secondRead);

    const result = await service.getQuestions('user-1', 'pitch-1', true);

    expect(prisma.qAQuestion.update).toHaveBeenCalledTimes(2);
    expect(result.questions[0].answer_guide).toContain('핵심 해결 방식');
    expect(result.questions[1].answer_guide).toContain('자금 사용 우선순위');
  });

  it('pitch가 없으면 PITCH_NOT_FOUND를 던진다', async () => {
    prisma.pitch.findUnique.mockResolvedValue(null);

    await expect(service.getQuestions('user-1', 'pitch-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('다른 사용자 pitch 접근 시 UNAUTHORIZED를 던진다', async () => {
    prisma.pitch.findUnique.mockResolvedValue({
      id: 'pitch-1',
      userId: 'other-user',
      isDeleted: false,
    });

    await expect(service.getQuestions('user-1', 'pitch-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('최신 QA 훈련이 없으면 QA_TRAINING_NOT_FOUND를 던진다', async () => {
    prisma.pitch.findUnique.mockResolvedValue({
      id: 'pitch-1',
      userId: 'user-1',
      isDeleted: false,
    });
    prisma.qATraining.findFirst.mockResolvedValue(null);

    await expect(service.getQuestions('user-1', 'pitch-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
