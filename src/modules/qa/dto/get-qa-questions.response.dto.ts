import { ApiProperty } from '@nestjs/swagger';
import { QAQuestionDto } from './set-qa-mode.response.dto';

export class QAQuestionWithAnswerStatusDto extends QAQuestionDto {
  @ApiProperty({
    example: false,
    description: '실제 답변이 저장되어 있는지 여부',
  })
  has_answer!: boolean;
}

export class QATrainingSummaryDto {
  @ApiProperty({
    example: 'uuid-qa-1',
    description: 'Q&A 훈련 ID',
  })
  qa_training_id!: string;

  @ApiProperty({
    example: 'GUIDE_ONLY',
    description: 'Q&A 훈련 방식',
  })
  mode!: string;

  @ApiProperty({
    example: 5,
    description: '총 질문 개수',
  })
  total_questions!: number;

  @ApiProperty({
    example: 1,
    description: '버전 번호',
  })
  version!: number;

  @ApiProperty({
    example: true,
    description: '최신 버전 여부',
  })
  is_latest!: boolean;
}

export class GetQAQuestionsResponseDto {
  @ApiProperty({
    example: 'uuid-pitch-1',
    description: 'Pitch ID',
  })
  pitch_id!: string;

  @ApiProperty({
    type: QATrainingSummaryDto,
    description: '최신 Q&A 훈련 정보',
  })
  qa_training!: QATrainingSummaryDto;

  @ApiProperty({
    type: [QAQuestionWithAnswerStatusDto],
    description: '예상 질문 목록과 답변 가이드',
  })
  questions!: QAQuestionWithAnswerStatusDto[];

  @ApiProperty({
    example: '2026-03-12T14:20:00.000Z',
    description: '최종 갱신 시각',
  })
  updated_at!: string;
}
