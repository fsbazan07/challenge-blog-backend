import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 401 }) statusCode: number;
  @ApiProperty({ example: 'Unauthorized' }) error: string;
  @ApiProperty({ example: 'Credenciales inválidas' }) message: string;
}
