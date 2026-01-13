import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity, PostStatus } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
  ) {}

  async create(userId: string, dto: CreatePostDto, coverUrl?: string | null) {
    const post = this.postsRepo.create({
      title: dto.title.trim(),
      excerpt: dto.excerpt?.trim() || null,
      content: dto.content,
      tags: dto.tags ?? [],
      status: dto.status ?? PostStatus.PUBLISHED,
      coverUrl: coverUrl ?? null,
      authorId: userId,
    });

    return this.postsRepo.save(post);
  }

  async listPublished(query: ListPostsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.postsRepo
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .addSelect(['author.id', 'author.name', 'author.email'])
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('post.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.q?.trim()) {
      qb.andWhere('post.title ILIKE :q', { q: `%${query.q.trim()}%` });
    }
    if (query.tag?.trim()) {
      qb.andWhere(':tag = ANY(post.tags)', {
        tag: query.tag.trim().toLowerCase(),
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((p) => ({
        id: p.id,
        title: p.title,
        excerpt: p.excerpt,
        coverUrl: p.coverUrl,
        status: p.status,
        tags: p.tags,
        created_at: p.created_at,
        author: p.author
          ? { id: p.author.id, name: p.author.name, email: p.author.email }
          : null,
      })),
      page,
      limit,
      total,
    };
  }

  async listMine(userId: string, query: ListPostsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.postsRepo
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .addSelect(['author.id', 'author.name', 'author.email'])
      .where('post.authorId = :userId', { userId })
      .andWhere('post.status != :deleted', { deleted: PostStatus.DELETED })
      .orderBy('post.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.q?.trim()) {
      qb.andWhere('post.title ILIKE :q', { q: `%${query.q.trim()}%` });
    }

    if (query.tag?.trim()) {
      qb.andWhere(':tag = ANY(post.tags)', {
        tag: query.tag.trim().toLowerCase(),
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows,
      page,
      limit,
      total,
    };
  }

  async updateMine(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
    cover?: Express.Multer.File,
  ) {
    const post = await this.postsRepo.findOne({
      where: { id: postId, authorId: userId },
    });

    if (!post) throw new NotFoundException('Post not found');

    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt?.trim() || null;
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.tags !== undefined) post.tags = dto.tags;
    if (dto.status !== undefined) post.status = dto.status;

    // ✅ si viene archivo, ya está guardado en ./uploads/covers
    if (cover?.filename) post.coverUrl = `/uploads/covers/${cover.filename}`;

    // ✅ remover cover sin subir nuevo
    if (!cover && dto.removeCover) post.coverUrl = null;

    return this.postsRepo.save(post);
  }

  async deleteMine(userId: string, postId: string) {
    const result = await this.postsRepo.update(
      { id: postId, authorId: userId },
      { status: PostStatus.DELETED },
    );

    if (!result.affected) {
      throw new NotFoundException('Post not found');
    }

    return { ok: true };
  }
}
