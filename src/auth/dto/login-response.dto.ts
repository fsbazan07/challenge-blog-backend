import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ example: 'blogger' }) role: string;
  @ApiProperty() isActive: boolean;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: LoginUserDto }) user: LoginUserDto;
}
