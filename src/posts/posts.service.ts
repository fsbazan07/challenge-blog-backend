import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PostEntity, PostStatus } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';

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

    // ✅ FIX: tags array => usar ANY
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
}
