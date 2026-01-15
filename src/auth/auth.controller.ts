import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { CurrentUser } from './decorator/current-user.decorator';
import * as jwtStrategy from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: jwtStrategy.JwtPayload) {
    return this.auth.me(user.sub);
  }

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

  @Post('refresh')
  @ApiOkResponse({ description: 'Renueva tokens con refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Cierra sesión e invalida refresh token' })
  logout(@CurrentUser() user: jwtStrategy.JwtPayload) {
    return this.auth.logout(user.sub);
  }
}
