import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '../entities/post.entity';

export class PostListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ required: false, nullable: true }) excerpt: string | null;
  @ApiProperty({ required: false, nullable: true }) coverUrl: string | null;
  @ApiProperty({ enum: PostStatus }) status: PostStatus;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() createdAt: Date;

  @ApiProperty({
    example: { id: 'uuid', name: 'Flor', email: 'flor@email.com' },
  })
  author: { id: string; name: string; email: string };
}
