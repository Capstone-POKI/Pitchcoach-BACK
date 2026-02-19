import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PitchType } from '@prisma/client';
import { NoticeType } from './notice-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePitchDto {

    // Pitch 제목
    @ApiProperty()
    @IsString() 
    @IsNotEmpty() 
    title: string;
    
    // Pitch 종류
    @ApiProperty({ enum: PitchType })
    @IsEnum(PitchType) 
    pitch_type: PitchType;

    // 발표 시간
    @ApiProperty({ minimum: 1, maximum: 20 })
    @Type(() => Number)
    @IsInt() 
    @Min(1) 
    @Max(20) 
    duration_minutes: number;

    // 공고문 여부
    @ApiProperty({ enum: NoticeType })
    @IsEnum(NoticeType) 
    notice_type: NoticeType;

}