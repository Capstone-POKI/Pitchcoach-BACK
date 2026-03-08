import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NoticeService } from './notice.service';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { UploadNoticeResponseDto } from './dto/upload-notice.response.dto';
import { NoticeResultCompletedResponseDto } from './dto/notice-result.response.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Notice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  @Post('pitches/:pitchId/notices/analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '공고문 PDF 업로드 및 분석 시작' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF 파일 (최대 10MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 202, type: UploadNoticeResponseDto })
  @ApiResponse({
    status: 400,
    schema: {
      example: {
        error: 'INVALID_FILE',
        message: 'PDF 파일만 업로드 가능합니다',
      },
    },
  })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'PITCH_NOT_FOUND' } },
  })
  uploadAndAnalyze(
    @Param('pitchId') pitchId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ): Promise<UploadNoticeResponseDto> {
    return this.noticeService.uploadAndAnalyze(pitchId, req.user.id, file);
  }

  @Get('notices/:noticeId')
  @ApiOperation({ summary: '공고문 분석 결과 조회 (polling 겸용)' })
  @ApiParam({ name: 'noticeId', description: '공고문 ID' })
  @ApiResponse({
    status: 200,
    type: NoticeResultCompletedResponseDto,
  })
  @ApiResponse({
    status: 401,
    schema: { example: { error: 'UNAUTHORIZED' } },
  })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'NOTICE_NOT_FOUND' } },
  })
  getNoticeResult(
    @Param('noticeId') noticeId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NoticeResultCompletedResponseDto> {
    return this.noticeService.getNoticeResult(
      noticeId,
      req.user.id,
    ) as Promise<NoticeResultCompletedResponseDto>;
  }

  @Patch('notices/:noticeId')
  @ApiOperation({ summary: '공고문 정보 수정 (Partial Update)' })
  @ApiParam({ name: 'noticeId', description: '공고문 ID' })
  @ApiBody({ type: UpdateNoticeDto })
  @ApiResponse({
    status: 200,
    type: NoticeResultCompletedResponseDto,
  })
  @ApiResponse({
    status: 400,
    schema: {
      example: {
        error: 'INVALID_REQUEST',
        message: '심사 기준은 1개 이상 필수',
      },
    },
  })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'NOTICE_NOT_FOUND' } },
  })
  updateNotice(
    @Param('noticeId') noticeId: string,
    @Body() dto: UpdateNoticeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<NoticeResultCompletedResponseDto> {
    return this.noticeService.updateNotice(
      noticeId,
      req.user.id,
      dto,
    ) as Promise<NoticeResultCompletedResponseDto>;
  }
}
