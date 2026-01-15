import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Florencia Bazan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'flor@email.com' })
  @IsEmail()
  @MaxLength(120)
  email: string;

  @ApiProperty({
    example: 'Flor!2026',
    description:
      'Mínimo 8 caracteres. Incluye mayúscula, minúscula, número y símbolo.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'La contraseña debe incluir mayúscula, minúscula, número y símbolo.',
  })
  password: string;
}
