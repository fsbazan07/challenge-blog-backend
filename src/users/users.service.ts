import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async getMe(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toResponse(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.name !== undefined) user.name = dto.name.trim();

    await this.usersRepo.save(user);
    return this.toResponse(user);
  }

  async deactivateMe(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.isActive = false;
    await this.usersRepo.save(user);

    return this.toResponse(user);
  }

  // helpers
  toResponse(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      role: user.role
        ? { id: user.role.id, code: user.role.code, name: user.role.name }
        : null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  // usado por AuthService
  async findByEmail(email: string) {
    return this.usersRepo.findOne({
      where: { email },
      relations: { role: true },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .addSelect('user.password') // 👈 NECESARIO por select:false
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // (Opcional pero recomendable) si la cuenta está desactivada, bloquear acciones
    if (!user.isActive) {
      throw new BadRequestException('La cuenta está desactivada.');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) {
      throw new BadRequestException('La contraseña actual no es válida.');
    }

    // Evitar "cambiar por la misma" (opcional)
    const same = await bcrypt.compare(dto.newPassword, user.password);
    if (same) {
      throw new BadRequestException('La nueva contraseña debe ser diferente.');
    }

    const saltRounds = 10; // o config/env si ya lo tenés
    user.password = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.usersRepo.save(user);

    return this.toResponse(user);
  }
}
