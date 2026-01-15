import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // -------------------- Profile: ver mis datos --------------------
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() user: JwtPayload) {
    return this.users.getMe(user.sub);
  }

  // -------------------- Profile: editar mis datos --------------------
  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.sub, dto);
  }

  // -------------------- Profile: dar de baja --------------------
  @Patch('me/deactivate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: UserResponseDto })
  deactivate(@CurrentUser() user: JwtPayload) {
    return this.users.deactivateMe(user.sub);
  }

  // -------------------- Profile: cambiar mi contraseña --------------------

  @Patch('me/password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Contraseña actualizada',
  })
  changeMyPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(user.sub, dto);
  }
}
