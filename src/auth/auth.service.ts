import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { Role } from 'src/users/entities/role.entity';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from 'src/users/users.service';
import type ms from 'ms';

type TokenPayload = Readonly<{ sub: string; role: string }>;
@Injectable()
export class AuthService {
  //login
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  private async signAccessToken(userId: string, roleCode: string) {
    const payload: TokenPayload = { sub: userId, role: roleCode };
    // usa config del JwtModule (secret/exp) si ya lo configuraste ahí
    return this.jwt.signAsync(payload);
  }

  private async signRefreshToken(userId: string, roleCode: string) {
    const payload: TokenPayload = { sub: userId, role: roleCode };

    const secret = this.cfg.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('Falta JWT_REFRESH_SECRET');
    }

    // 👇 ms.StringValue es el tipo correcto para "7d", "15m", etc.
    const expiresIn = (this.cfg.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as ms.StringValue;

    const options: JwtSignOptions = { secret, expiresIn };

    // 👇 NO any: payload es objeto, jwt acepta JwtPayload = string | Buffer | object
    return this.jwt.signAsync(payload, options);
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const saltRounds = Number(this.cfg.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const hash = await bcrypt.hash(refreshToken, saltRounds);

    const days = Number(this.cfg.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.usersRepo.update(
      { id: userId },
      { refreshTokenHash: hash, refreshTokenExpiresAt: expiresAt },
    );
  }

  private async issueSession(user: User) {
    const roleCode = user.role.code;

    const accessToken = await this.signAccessToken(user.id, roleCode);
    const refreshToken = await this.signRefreshToken(user.id, roleCode);

    await this.saveRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    if (!rememberBoolean(user?.isActive, true)) {
      throw new ForbiddenException('Usuario deshabilitado');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const { accessToken, refreshToken } = await this.issueSession(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.code,
        isActive: user.isActive,
      },
    };
  }
  //register
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const name = dto.name.trim();

    // chequeo rápido (igual mantenemos robustez con unique)
    const exists = await this.usersRepo.findOne({ where: { email } });
    if (exists) throw new ConflictException('Email ya registrado');

    const bloggerRole =
      (await this.rolesRepo.findOne({ where: { code: 'BLOGGER' } })) ??
      (await this.rolesRepo.findOne({ where: { name: 'blogger' } }));

    if (!bloggerRole?.code) {
      // si falta rol o code -> dataset inconsistente (faltó seed/migración)
      throw new InternalServerErrorException(
        'Rol BLOGGER no encontrado. Ejecutá seeds.',
      );
    }

    const saltRounds = Number(this.cfg.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    try {
      const user = this.usersRepo.create({
        name,
        email,
        password: passwordHash,
        isActive: true,
        role: bloggerRole,
      });

      const saved = await this.usersRepo.save(user);

      const { accessToken, refreshToken } = await this.issueSession(saved);

      return {
        accessToken,
        refreshToken,
        user: {
          id: saved.id,
          name: saved.name,
          email: saved.email,
          role: bloggerRole.code,
          isActive: saved.isActive,
        },
      };
    } catch (e: unknown) {
      // robusto contra race condition: si dos requests registran mismo email
      const err = e as { code?: string };
      if (err?.code === '23505') {
        throw new ConflictException('Email ya registrado');
      }
      throw e;
    }
  }

  async refresh(refreshToken: string) {
    const secret = this.cfg.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('Falta JWT_REFRESH_SECRET');
    }

    // 1) Verificar firma del refresh token
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const userId = payload?.sub as string | undefined;
    if (!userId) throw new UnauthorizedException('Refresh token inválido');

    // 2) Traer user + refreshTokenHash (select:false)
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new UnauthorizedException('Refresh token inválido');

    if (!rememberBoolean(user.isActive, true)) {
      throw new ForbiddenException('Usuario deshabilitado');
    }

    // 3) Chequear expiración guardada server-side
    if (
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        'Sesión expirada. Iniciá sesión de nuevo.',
      );
    }

    // 4) Comparar hash
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException(
        'Sesión inválida. Iniciá sesión de nuevo.',
      );
    }

    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Refresh token inválido');

    // 5) Rotación: emitir y guardar nuevo refresh
    const { accessToken, refreshToken: newRefresh } =
      await this.issueSession(user);

    return { accessToken, refreshToken: newRefresh };
  }

  async me(userId: string) {
    const user = await this.users.getMe(userId);
    return { user };
  }
  async logout(userId: string) {
    await this.usersRepo.update(
      { id: userId },
      { refreshTokenHash: null, refreshTokenExpiresAt: null },
    );
    return { ok: true };
  }
}

function rememberBoolean(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback;
}
