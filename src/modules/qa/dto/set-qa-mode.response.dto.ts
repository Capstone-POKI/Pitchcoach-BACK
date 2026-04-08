import { ApiProperty } from '@nestjs/swagger';

export class QAQuestionDto {
  @ApiProperty({
    example: 'uuid-q-1',
    description: 'Q&A 질문 ID',
  })
  question_id: string;

  @ApiProperty({
    example: 'PROBLEM',
    description: '질문 카테고리',
  })
  category: string;

  @ApiProperty({
    example: 1,
    description: '질문 노출 순서',
  })
  display_order: number;

  @ApiProperty({
    example: '현재 고객이 겪는 가장 큰 문제는 무엇이며, 왜 반드시 해결되어야 하나요?',
    description: '질문 본문',
  })
  question: string;

  @ApiProperty({
    example: '문제의 구체적 상황, 빈도, 기존 대안의 한계를 함께 설명하세요.',
    description: '답변 가이드',
  })
  answer_guide: string;
}

export class QATrainingDto {
  @ApiProperty({
    example: 'uuid-qa-1',
    description: 'Q&A 훈련 ID',
  })
  qa_training_id: string;

  @ApiProperty({
    example: 'uuid-notice-1',
    description: '공고문 ID',
    nullable: true,
  })
  notice_id: string | null;

  @ApiProperty({
    example: 'uuid-deck-1',
    description: 'IR Deck ID',
    nullable: true,
  })
  ir_deck_id: string | null;

  @ApiProperty({
    example: 'uuid-voice-1',
    description: '음성 분석 ID',
    nullable: true,
  })
  voice_analysis_id: string | null;

  @ApiProperty({
    example: 'REALTIME',
    description: 'Q&A 훈련 방식',
  })
  mode: string;

  @ApiProperty({
    example: 5,
    description: '총 질문 개수',
  })
  total_questions: number;

  @ApiProperty({
    example: 2,
    description: '버전 번호',
  })
  version: number;

  @ApiProperty({
    example: true,
    description: '최신 버전 여부',
  })
  is_latest: boolean;

  @ApiProperty({
    example: '2026-03-05T10:00:00Z',
    description: '생성 시간',
  })
  created_at: string;

  @ApiProperty({
    example: '2026-03-05T10:02:00Z',
    description: '수정 시간',
  })
  updated_at: string;
}

export class SetQAModeResponseDto {
  @ApiProperty({
    example: 'uuid-pitch-1234',
    description: 'Pitch ID',
  })
  pitch_id: string;

  @ApiProperty({
    type: QATrainingDto,
    description: 'Q&A 훈련 정보',
  })
  qa_training: QATrainingDto;

  @ApiProperty({
    type: [QAQuestionDto],
    description: '생성된 Q&A 질문 목록',
  })
  questions: QAQuestionDto[];
}
