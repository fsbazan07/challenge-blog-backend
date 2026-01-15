import { ApiProperty } from '@nestjs/swagger';
import { PostListItemDto } from './post-list-item.dto';

export class ListPostsResponseDto {
  @ApiProperty({ type: [PostListItemDto] })
  items: PostListItemDto[];

  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 10 }) limit: number;
  @ApiProperty({ example: 123 }) total: number;
}
