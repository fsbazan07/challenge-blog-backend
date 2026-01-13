import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { PostStatus } from '../entities/post.entity';

function parseStringArray(params: TransformFnParams): string[] | undefined {
  const value: unknown = params.value;

  // no enviado => no tocar
  if (value === undefined || value === null) return undefined;

  // tags=nestjs&tags=ts  => ['nestjs','ts']
  if (Array.isArray(value)) {
    return value
      .map((v): string => String(v).trim())
      .filter((v): v is string => v.length > 0);
  }

  // tags="nestjs, ts"  OR tags='["nestjs","ts"]'
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];

    // JSON array
    if (s.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v): string => String(v).trim())
            .filter((v): v is string => v.length > 0);
        }
        return [];
      } catch {
        // fallback a CSV
        return s
          .split(',')
          .map((x) => x.trim())
          .filter((x): x is string => x.length > 0);
      }
    }

    // CSV
    return s
      .split(',')
      .map((x) => x.trim())
      .filter((x): x is string => x.length > 0);
  }

  // cualquier otro tipo raro => ignorar (no tocar)
  return undefined;
}

function parseBooleanOptional(params: TransformFnParams): boolean | undefined {
  const value: unknown = params.value;
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return undefined;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ example: 'Nuevo título' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Nuevo excerpt', nullable: true })
  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @ApiPropertyOptional({ example: 'Contenido del post' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: ['typescript', 'nestjs'], type: [String] })
  @IsOptional()
  @Transform(parseStringArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({
    example: false,
    description: 'Remove current cover image (only if no new cover uploaded)',
  })
  @IsOptional()
  @Transform(parseBooleanOptional)
  @IsBoolean()
  removeCover?: boolean;
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  cover?: unknown;
}
