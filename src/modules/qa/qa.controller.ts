import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetQAQuestionsResponseDto } from './dto/get-qa-questions.response.dto';
import { SetQAModeDto } from './dto/set-qa-mode.dto';
import { SetQAModeResponseDto } from './dto/set-qa-mode.response.dto';
import { QaService } from './qa.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

function parseBooleanQuery(value: string | string[] | undefined): boolean {
  if (value == null) return false;

  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    if (value.length > 1) {
      throw new BadRequestException({
        error: 'INVALID_REQUEST',
        message: 'regenerate_guides는 boolean 값이어야 합니다.',
      });
    }

    return parseBooleanQuery(value[0]);
  }

  if (value === '') return false;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  throw new BadRequestException({
    error: 'INVALID_REQUEST',
    message: 'regenerate_guides는 boolean 값이어야 합니다.',
  });
}

@ApiTags('QA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Get('pitches/:pitchId/questions')
  @ApiOperation({
    summary: '질문 목록 조회 및 답변 가이드 생성',
    description:
      '특정 Pitch의 최신 Q&A 훈련 질문을 조회하고, 답변 가이드가 비어 있으면 자동 생성하여 저장합니다. regenerate_guides=true이면 기존 가이드도 재생성합니다.',
  })
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiQuery({
    name: 'regenerate_guides',
    required: false,
    type: Boolean,
    example: false,
    description: '기존 답변 가이드를 재생성할지 여부',
  })
  @ApiResponse({
    status: 200,
    description: '질문 목록 조회 및 답변 가이드 생성 성공',
    type: GetQAQuestionsResponseDto,
  })
  @ApiResponse({
    status: 401,
    schema: {
      example: { error: 'UNAUTHORIZED', message: '인증이 필요합니다.' },
    },
  })
  @ApiResponse({
    status: 403,
    schema: {
      example: {
        error: 'UNAUTHORIZED',
        message: '해당 pitch에 접근할 권한이 없습니다.',
      },
    },
  })
  @ApiResponse({
    status: 404,
    schema: {
      oneOf: [
        {
          example: {
            error: 'PITCH_NOT_FOUND',
            message: '해당 pitch를 찾을 수 없습니다.',
          },
        },
        {
          example: {
            error: 'QA_TRAINING_NOT_FOUND',
            message: '최신 Q&A 훈련 정보를 찾을 수 없습니다.',
          },
        },
      ],
    },
  })
  getQuestions(
    @Param('pitchId') pitchId: string,
    @Query('regenerate_guides') regenerateGuides: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<GetQAQuestionsResponseDto> {
    return this.qaService.getQuestions(
      req.user.id,
      pitchId,
      parseBooleanQuery(regenerateGuides),
    );
  }

  @Patch('pitches/:pitchId/qa-mode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Q&A 훈련 방식 선택 및 질문 생성',
    description:
      '사용자가 "질문만 보기" 또는 "실시간 연습하기" 모드를 선택하면 해당 Pitch의 QATraining.mode 값이 설정되며, 예상 질문이 함께 생성됩니다.',
  })
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiBody({ type: SetQAModeDto })
  @ApiResponse({
    status: 200,
    description: 'Q&A 훈련 설정 및 질문 생성 성공',
    type: SetQAModeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_QA_MODE 또는 INVALID_REQUEST',
    schema: {
      oneOf: [
        {
          example: {
            error: 'INVALID_QA_MODE',
            message: 'qa_mode는 REALTIME 또는 GUIDE_ONLY 이어야 합니다.',
          },
        },
        {
          example: {
            error: 'INVALID_REQUEST',
            message: 'force_regenerate는 boolean 값이어야 합니다.',
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    schema: {
      example: { error: 'UNAUTHORIZED', message: '인증이 필요합니다.' },
    },
  })
  @ApiResponse({
    status: 404,
    schema: {
      example: {
        error: 'PITCH_NOT_FOUND',
        message: '해당 pitch를 찾을 수 없습니다.',
      },
    },
  })
  @ApiResponse({
    status: 409,
    schema: {
      example: {
        error: 'VOICE_ANALYSIS_NOT_COMPLETED',
        message:
          'Q&A 훈련 설정 및 질문 생성은 피칭 음성 분석 완료 후 가능합니다.',
      },
    },
  })
  setQAMode(
    @Param('pitchId') pitchId: string,
    @Body() dto: SetQAModeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SetQAModeResponseDto> {
    return this.qaService.setQAMode(req.user.id, pitchId, dto);
  }
}
