import { ApiProperty } from '@nestjs/swagger';

class RoleDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
}

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() isActive: boolean;

  @ApiProperty({ type: RoleDto, nullable: true })
  role: RoleDto | null;

  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
