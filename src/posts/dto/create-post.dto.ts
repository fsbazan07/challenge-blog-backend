import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { PostStatus } from '../entities/post.entity';
import { Transform } from 'class-transformer';

export class CreatePostDto {
  @ApiProperty({ example: 'Cómo armé mi auth con NestJS' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'Resumen corto para el feed...' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  excerpt?: string;

  @ApiProperty({ example: 'Contenido completo del post...' })
  @IsString()
  @MinLength(30)
  content: string;

  @ApiPropertyOptional({ example: ['nestjs', 'typescript'] })
  @IsOptional()
  @Transform(({ value }) => {
    // tags=nestjs&tags=ts  -> ['nestjs','ts']
    if (Array.isArray(value))
      return value.map((v) => String(v).trim()).filter(Boolean);

    // tags="nestjs, ts" -> ['nestjs','ts']
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [];
  })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  cover?: unknown;
}
