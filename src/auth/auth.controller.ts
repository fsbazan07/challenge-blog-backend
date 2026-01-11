import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterDto } from './dto/register.dto';

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

  @Post('register')
  @ApiCreatedResponse({
    type: RegisterResponseDto,
    description: 'Registro exitoso',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'DTO inválido',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email ya registrado',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
}
