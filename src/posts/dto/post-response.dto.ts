import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '../entities/post.entity';

export class PostResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) excerpt: string | null;
  @ApiProperty() content: string;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty({ nullable: true }) coverUrl: string | null;
  @ApiProperty({ enum: PostStatus }) status: PostStatus;
  @ApiProperty() authorId: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
