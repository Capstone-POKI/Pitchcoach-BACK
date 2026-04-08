import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetQAModeDto } from './dto/set-qa-mode.dto';
import { SetQAModeResponseDto } from './dto/set-qa-mode.response.dto';
import { QaService } from './qa.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('QA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class QaController {
  constructor(private readonly qaService: QaService) {}

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
    schema: { example: { error: 'UNAUTHORIZED', message: '인증이 필요합니다.' } },
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
