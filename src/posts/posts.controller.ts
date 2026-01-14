import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { diskStorage } from 'multer';
import { extname } from 'path';

import type { JwtPayload } from '../auth/strategies/jwt.strategy';

import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { ListPostsResponseDto } from './dto/list-posts-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';

function safeFilename(
  _req: unknown,
  file: { originalname: string },
  cb: (err: any, filename: string) => void,
) {
  const ext = extname(file.originalname).toLowerCase();
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  cb(null, name);
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

function coverFileFilter(
  _req: unknown,
  file: { mimetype: string },
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(
      new BadRequestException('Formato no soportado. Usá JPG, PNG o WEBP.'),
      false,
    );
  }
  cb(null, true);
}

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  //-------------------------------------- Get --------------------------------------------------//

  //------------------------------ Listar posts publicados (feed público) ------------------------//

  @Get()
  @ApiOkResponse({ type: ListPostsResponseDto, description: 'Feed público' })
  list(@Query() query: ListPostsQueryDto) {
    return this.posts.listPublished(query);
  }

  //------------------------------ Listar mis posts (auth) ---------------------------------------//

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: JwtPayload, @Query() query: ListPostsQueryDto) {
    return this.posts.listMine(user.sub, query);
  }

  //------------------------------ Obtener post por ID (público/auth) ----------------------------//
  @Get(':id')
  @ApiOkResponse({ type: PostResponseDto, description: 'Detalle de post' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const userId = user.sub; // puede ser undefined si es público
    return this.posts.getById(id, userId);
  }
  //------------------------------------- Post --------------------------------------------------//

  //------------------------------- Crear nuevo post (auth) -------------------------------------//
  @Post()
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Cómo armé mi primer post' },
        excerpt: { type: 'string', example: 'Resumen corto para el feed' },
        content: { type: 'string', example: 'Contenido completo del post...' },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          example: 'published',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['nestjs', 'typescript'],
        },
        cover: { type: 'string', format: 'binary' },
      },
      required: ['title', 'content'],
    },
  })
  @UseInterceptors(
    FileInterceptor('cover', {
      storage: diskStorage({
        destination: './uploads/covers',
        filename: safeFilename,
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: coverFileFilter,
    }),
  )
  @ApiCreatedResponse({ type: PostResponseDto, description: 'Post creado' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'DTO inválido / archivo inválido',
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
    @UploadedFile() cover?: { filename: string }, // 👈 opcional, sin pipe
  ) {
    const userId = user.sub;
    const coverUrl = cover?.filename
      ? `/uploads/covers/${cover.filename}`
      : null;
    return this.posts.create(userId, dto, coverUrl);
  }

  //------------------------------------ Update --------------------------------------------------//
  //------------------------------- Actualizar mi post (auth) -------------------------------------//

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('cover', {
      storage: diskStorage({
        destination: './uploads/covers',
        filename: safeFilename,
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: coverFileFilter,
    }),
  )
  updateMine(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePostDto,
    @UploadedFile() cover?: { filename: string }, // 👈 importante
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.posts.updateMine(user.sub, id, dto, cover as any);
  }

  //------------------------------------ Delete --------------------------------------------------//
  //------------------------------- Eliminar mi post (auth) -------------------------------------//

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteMine(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.deleteMine(user.sub, id);
  }
}
