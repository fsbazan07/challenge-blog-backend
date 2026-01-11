import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { Role } from 'src/users/entities/role.entity';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  //login
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

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

    const payload = { sub: user.id, role: user.role.code };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
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

      const payload = { sub: saved.id, role: bloggerRole.code };
      const accessToken = await this.jwt.signAsync(payload);

      return {
        accessToken,
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
}

function rememberBoolean(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback;
}
