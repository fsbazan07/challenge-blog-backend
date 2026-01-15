import { ApiProperty } from '@nestjs/swagger';

class RegisterUserDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ example: 'BLOGGER' }) role: string;
  @ApiProperty() isActive: boolean;
}

export class RegisterResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: RegisterUserDto }) user: RegisterUserDto;
}
