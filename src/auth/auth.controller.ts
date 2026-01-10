import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOkResponse({ type: LoginResponseDto, description: 'Login exitoso' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'DTO inválido',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Credenciales inválidas',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Usuario deshabilitado',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
