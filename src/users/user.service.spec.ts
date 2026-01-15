/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

type UserQB = Pick<
  SelectQueryBuilder<User>,
  'leftJoinAndSelect' | 'addSelect' | 'where' | 'getOne'
>;

function makeUserQB(): jest.Mocked<UserQB> {
  const qb: Partial<jest.Mocked<UserQB>> = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb as jest.Mocked<UserQB>);
  qb.addSelect = jest.fn().mockReturnValue(qb as jest.Mocked<UserQB>);
  qb.where = jest.fn().mockReturnValue(qb as jest.Mocked<UserQB>);
  qb.getOne = jest.fn();
  return qb as jest.Mocked<UserQB>;
}

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r1',
    code: 'BLOGGER',
    name: 'blogger',
    users: [],
    ...overrides,
  } as Role;
}

function makeUser(overrides: Partial<User> = {}): User {
  const role = makeRole();
  return {
    id: 'u1',
    name: 'Flor',
    email: 'a@a.com',
    password: 'hashed_pw',
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    isActive: true,
    role,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          } satisfies Partial<jest.Mocked<Repository<User>>>,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    usersRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------
  // getMe
  // -------------------------
  describe('getMe', () => {
    it('retorna el user mapeado (toResponse)', async () => {
      const user = makeUser();
      usersRepo.findOne.mockResolvedValue(user);

      const res = await service.getMe('u1');

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'u1' },
        relations: { role: true },
      });

      expect(res).toEqual({
        id: 'u1',
        name: 'Flor',
        email: 'a@a.com',
        isActive: true,
        role: { id: 'r1', code: 'BLOGGER', name: 'blogger' },
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
    });

    it('si no existe: NotFound', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.getMe('404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // -------------------------
  // updateMe
  // -------------------------
  describe('updateMe', () => {
    it('actualiza name (trim) y guarda', async () => {
      const user = makeUser({ name: 'Viejo' });
      usersRepo.findOne.mockResolvedValue(user);
      usersRepo.save.mockResolvedValue(user);

      const dto: UpdateMeDto = { name: '  Nuevo  ' };

      const res = await service.updateMe('u1', dto);

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'u1' },
        relations: { role: true },
      });

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nuevo' }),
      );

      expect(res).toEqual({
        id: 'u1',
        name: 'Nuevo',
        email: 'a@a.com',
        isActive: true,
        role: { id: 'r1', code: 'BLOGGER', name: 'blogger' },
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
    });

    it('si no existe: NotFound', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const dto: UpdateMeDto = { name: 'X' };
      await expect(service.updateMe('404', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si dto.name es undefined, igual guarda pero no cambia name', async () => {
      const user = makeUser({ name: 'Flor' });
      usersRepo.findOne.mockResolvedValue(user);
      usersRepo.save.mockResolvedValue(user);

      const dto = {} as UpdateMeDto;

      const res = await service.updateMe('u1', dto);

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Flor' }),
      );
      expect(res.name).toBe('Flor');
    });
  });

  // -------------------------
  // deactivateMe
  // -------------------------
  describe('deactivateMe', () => {
    it('marca isActive=false, guarda y retorna toResponse', async () => {
      const user = makeUser({ isActive: true });
      usersRepo.findOne.mockResolvedValue(user);
      usersRepo.save.mockResolvedValue(user);

      const res = await service.deactivateMe('u1');

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'u1' },
        relations: { role: true },
      });

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );

      expect(res.isActive).toBe(false);
    });

    it('si no existe: NotFound', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivateMe('404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // -------------------------
  // findByEmail
  // -------------------------
  describe('findByEmail', () => {
    it('llama findOne con where email y relations role', async () => {
      const user = makeUser();
      usersRepo.findOne.mockResolvedValue(user);

      const res = await service.findByEmail('a@a.com');

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'a@a.com' },
        relations: { role: true },
      });
      expect(res).toBe(user);
    });
  });

  // -------------------------
  // changePassword
  // -------------------------
  describe('changePassword', () => {
    it('OK: valida currentPassword, evita same, hashea y guarda', async () => {
      const qb = makeUserQB();

      const user = makeUser({
        isActive: true,
        password: 'old_hash',
      });

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      // currentPassword OK
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>)
        .mockResolvedValueOnce(true)
        // same password? -> false (no es igual)
        .mockResolvedValueOnce(false);

      (
        bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('new_hash');

      usersRepo.save.mockResolvedValue(user);

      const dto: ChangePasswordDto = {
        currentPassword: 'old_pw',
        newPassword: 'new_pw',
      };

      const res = await service.changePassword('u1', dto);

      expect(usersRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.role', 'role');
      expect(qb.addSelect).toHaveBeenCalledWith('user.password');
      expect(qb.where).toHaveBeenCalledWith('user.id = :userId', {
        userId: 'u1',
      });

      expect(bcrypt.compare).toHaveBeenNthCalledWith(1, 'old_pw', 'old_hash');
      expect(bcrypt.compare).toHaveBeenNthCalledWith(2, 'new_pw', 'old_hash');

      // saltRounds fijo = 10 (como en tu service)
      expect(bcrypt.hash).toHaveBeenCalledWith('new_pw', 10);

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'new_hash' }),
      );

      expect(res).toEqual({
        id: 'u1',
        name: 'Flor',
        email: 'a@a.com',
        isActive: true,
        role: { id: 'r1', code: 'BLOGGER', name: 'blogger' },
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
    });

    it('si no existe: NotFound', async () => {
      const qb = makeUserQB();
      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(null);

      const dto: ChangePasswordDto = {
        currentPassword: 'x',
        newPassword: 'y',
      };

      await expect(service.changePassword('404', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si está desactivado: BadRequest', async () => {
      const qb = makeUserQB();
      const user = makeUser({ isActive: false });

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      const dto: ChangePasswordDto = {
        currentPassword: 'x',
        newPassword: 'y',
      };

      await expect(service.changePassword('u1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('si currentPassword es inválida: BadRequest', async () => {
      const qb = makeUserQB();
      const user = makeUser({ isActive: true, password: 'old_hash' });

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      (
        bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>
      ).mockResolvedValueOnce(false);

      const dto: ChangePasswordDto = {
        currentPassword: 'bad',
        newPassword: 'new_pw',
      };

      await expect(service.changePassword('u1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('si newPassword es igual a la actual: BadRequest', async () => {
      const qb = makeUserQB();
      const user = makeUser({ isActive: true, password: 'old_hash' });

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>)
        // current ok
        .mockResolvedValueOnce(true)
        // same password -> true
        .mockResolvedValueOnce(true);

      const dto: ChangePasswordDto = {
        currentPassword: 'old_pw',
        newPassword: 'old_pw',
      };

      await expect(service.changePassword('u1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
