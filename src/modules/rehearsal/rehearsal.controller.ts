import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RehearsalService } from './rehearsal.service';
import { RehearsalVersionsResponseDto } from './dto/rehearsal-versions.response.dto';
import { RehearsalCompareResponseDto } from './dto/rehearsal-compare.response.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Rehearsal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class RehearsalController {
  constructor(private readonly rehearsalService: RehearsalService) {}

  @Post([
    'pitches/:pitchId/rehearsals',
    'pitches/:pitchId/voice/upload-and-analyze',
  ])
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '음성 업로드 및 분석 시작' })
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiResponse({ status: 202, description: '음성 분석 시작됨' })
  @ApiResponse({ status: 400, schema: { example: { error: 'INVALID_FILE' } } })
  @ApiResponse({ status: 404, schema: { example: { error: 'PITCH_NOT_FOUND' } } })
  uploadAndAnalyze(
    @Param('pitchId') pitchId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('slide_timestamps') slideTimestamps: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rehearsalService.uploadAndAnalyze(
      pitchId,
      req.user.id,
      file,
      slideTimestamps,
    );
  }

  @Get(['rehearsals/:voiceId', 'voice/:voiceId'])
  @ApiOperation({ summary: '음성 분석 결과 조회' })
  @ApiParam({ name: 'voiceId', description: 'Voice Analysis ID' })
  @ApiResponse({ status: 200, description: 'IN_PROGRESS | COMPLETED | FAILED' })
  @ApiResponse({ status: 404, schema: { example: { error: 'VOICE_ANALYSIS_NOT_FOUND' } } })
  getResult(
    @Param('voiceId') voiceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rehearsalService.getRehearsalResult(voiceId, req.user.id);
  }

  @Get(['rehearsals/:voiceId/slides', 'voice/:voiceId/slides'])
  @ApiOperation({ summary: '음성 분석 슬라이드별 결과 조회' })
  @ApiParam({ name: 'voiceId', description: 'Voice Analysis ID' })
  @ApiResponse({ status: 200, description: 'IN_PROGRESS | COMPLETED' })
  @ApiResponse({ status: 404, schema: { example: { error: 'VOICE_ANALYSIS_NOT_FOUND' } } })
  getSlides(
    @Param('voiceId') voiceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rehearsalService.getRehearsalSlides(voiceId, req.user.id);
  }

  @Get('pitches/:pitchId/voice/versions')
  @ApiOperation({ summary: '음성 분석 버전 목록 조회' })
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiResponse({ status: 200, type: RehearsalVersionsResponseDto })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'PITCH_NOT_FOUND' } },
  })
  @ApiResponse({
    status: 404,
    schema: {
      example: {
        error: 'NO_VOICE_ANALYSES',
        message: '음성 분석 이력이 없습니다.',
      },
    },
  })
  getVersions(
    @Param('pitchId') pitchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rehearsalService.getRehearsalVersions(pitchId, req.user.id);
  }

  @Get('voice/:voiceId/compare')
  @ApiOperation({ summary: '음성 버전 비교' })
  @ApiParam({ name: 'voiceId', description: '현재 음성 분석 ID' })
  @ApiResponse({ status: 200, type: RehearsalCompareResponseDto })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'VOICE_NOT_FOUND' } },
  })
  getCompare(
    @Param('voiceId') voiceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rehearsalService.getRehearsalCompare(voiceId, req.user.id);
  }
}
