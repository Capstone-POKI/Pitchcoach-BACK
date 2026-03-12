import {
  Controller,
  Post,
  Get,
  Param,
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
import { DeckService } from './deck.service';
import { UploadDeckResponseDto } from './dto/upload-deck.response.dto';
import { DeckSummaryCompletedResponseDto } from './dto/deck-summary.response.dto';
import { DeckSlidesCompletedResponseDto } from './dto/deck-slides.response.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('IR Deck')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class DeckController {
  constructor(private readonly deckService: DeckService) {}

  @Post('pitches/:pitchId/ir-decks/analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'IR Deck PDF 업로드 및 분석 시작' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'pitchId', description: 'Pitch ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF 파일 (최대 100MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 202, type: UploadDeckResponseDto })
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
  ): Promise<UploadDeckResponseDto> {
    return this.deckService.uploadAndAnalyze(pitchId, req.user.id, file);
  }

  @Get('ir-decks/:deckId')
  @ApiOperation({ summary: 'IR Deck 종합 분석 결과 조회 (polling 겸용)' })
  @ApiParam({ name: 'deckId', description: 'IR Deck ID' })
  @ApiResponse({ status: 200, type: DeckSummaryCompletedResponseDto })
  @ApiResponse({
    status: 404,
    schema: { example: { error: 'IR_DECK_NOT_FOUND' } },
  })
  getIrDeckResult(
    @Param('deckId') deckId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deckService.getIrDeckResult(deckId, req.user.id);
  }

  @Get('ir-decks/:deckId/slides')
  @ApiOperation({ summary: 'IR Deck 슬라이드별 분석 결과 조회' })
  @ApiParam({ name: 'deckId', description: 'IR Deck ID' })
  @ApiResponse({ status: 200, type: DeckSlidesCompletedResponseDto })
  @ApiResponse({
    status: 404,
    schema: {
      example: {
        error: 'IR_DECK_NOT_FOUND',
        message: '존재하지 않는 IR Deck입니다',
      },
    },
  })
  getIrDeckSlides(
    @Param('deckId') deckId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deckService.getIrDeckSlides(deckId, req.user.id);
  }
}
