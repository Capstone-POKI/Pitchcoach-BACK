import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PitchService } from './pitch.service';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { CreatePitchResponseDto } from './dto/create-pitch.response.dto';

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
}
