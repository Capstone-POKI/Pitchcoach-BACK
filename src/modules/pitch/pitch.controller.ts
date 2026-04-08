import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PitchService } from './pitch.service';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { CreatePitchResponseDto } from './dto/create-pitch.response.dto';
import { ListPitchesDto } from './dto/list-pitches.dto';
import { UpdatePitchStatusDto } from './dto/update-pitch-status.dto';
import { SetQAModeDto } from './dto/set-qa-mode.dto';
import { SetQAModeResponseDto } from './dto/set-qa-mode.response.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Pitch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class PitchController {
  constructor(private readonly pitchService: PitchService) {}

  @Post('pitches')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '피칭 프로젝트 생성' })
  @ApiBody({ type: CreatePitchDto })
  @ApiResponse({ status: 201, type: CreatePitchResponseDto })
  @ApiResponse({
    status: 400,
    schema: {
      example: {
        error: 'INVALID_REQUEST',
        message: '필수 항목 누락 또는 유효하지 않은 값',
      },
    },
  })
  @ApiResponse({
    status: 401,
    schema: { example: { error: 'UNAUTHORIZED' } },
  })
  create(
    @Body() dto: CreatePitchDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CreatePitchResponseDto> {
    return this.pitchService.create(req.user.id, dto);
  }

  @Get('pitches')
  @ApiOperation({
    summary: 'Pitch 목록 전체 조회',
    description:
      '응답 status는 COMPLETED 외의 내부 진행 상태(SETUP, NOTICE_ANALYSIS, IRDECK_ANALYSIS, REHEARSAL)를 모두 IN_PROGRESS로 매핑합니다.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['IN_PROGRESS', 'COMPLETED'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Pitch 목록 조회 성공',
    schema: {
      example: {
        pitches: [
          {
            pitch_id: 'uuid-1234',
            title: '2024 스타트업 경진대회',
            pitch_type: 'COMPETITION',
            pitch_type_display: '창업경진대회',
            status: 'IN_PROGRESS',
            application_period: '2024-11-12 ~ 2024-12-01',
            created_at: '2026-02-06T10:00:00.000Z',
            updated_at: '2026-02-06T12:00:00.000Z',
          },
        ],
        total: 4,
        page: 1,
        limit: 20,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'UNAUTHORIZED',
  })
  list(
    @Query() query: ListPitchesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pitchService.findAll(req.user.id, query);
  }

  @Patch('pitches/:pitchId/status')
  @ApiOperation({
    summary: 'Pitch 상태 변경',
    description:
      '프론트 계약은 IN_PROGRESS | COMPLETED를 사용합니다. IN_PROGRESS 요청 시 내부적으로는 진행중 상태로 복귀하며, 완료 상태였던 경우 REHEARSAL로 되돌립니다.',
  })
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiBody({ type: UpdatePitchStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Pitch 상태 변경 성공',
    schema: {
      example: {
        pitch_id: 'uuid-1234',
        status: 'COMPLETED',
        updated_at: '2026-02-06T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_STATUS',
  })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'PITCH_NOT_FOUND' } },
  })
  updateStatus(
    @Param('pitchId') pitchId: string,
    @Body() dto: UpdatePitchStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pitchService.updateStatus(req.user.id, pitchId, dto);
  }

  @Delete('pitches/:pitchId')
  @ApiOperation({ summary: 'Pitch 삭제' })
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiResponse({
    status: 200,
    description: 'Pitch 삭제 성공',
    schema: {
      example: {
        pitch_id: 'uuid-1234',
        is_deleted: true,
        deleted_at: '2026-02-06T12:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'PITCH_NOT_FOUND' } },
  })
  remove(
    @Param('pitchId') pitchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pitchService.softDelete(req.user.id, pitchId);
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
    schema: { example: { error: 'UNAUTHORIZED' } },
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
    return this.pitchService.setQAMode(req.user.id, pitchId, dto);
  }
}
