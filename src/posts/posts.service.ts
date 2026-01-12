import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity, PostStatus } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';

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
}
