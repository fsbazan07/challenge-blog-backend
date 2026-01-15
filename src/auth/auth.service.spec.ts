/* eslint-disable @typescript-eslint/unbound-method */
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, SelectQueryBuilder, UpdateResult } from 'typeorm';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

type TokenPayload = Readonly<{ sub: string; role: string }>;

type UserQB = Pick<
  SelectQueryBuilder<User>,
  'addSelect' | 'leftJoinAndSelect' | 'where' | 'getOne'
>;

function makeUserQB(): jest.Mocked<UserQB> {
  // objeto “fluent” que retorna this en cada método
  const qb: Partial<jest.Mocked<UserQB>> = {};
  qb.addSelect = jest.fn().mockReturnValue(qb as jest.Mocked<UserQB>);
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb as jest.Mocked<UserQB>);
  qb.where = jest.fn().mockReturnValue(qb as jest.Mocked<UserQB>);
  qb.getOne = jest.fn();
  return qb as jest.Mocked<UserQB>;
}

function updateResult(affected: number): UpdateResult {
  return {
    generatedMaps: [],
    raw: [],
    affected,
  } as UpdateResult;
}

describe('AuthService', () => {
  let service: AuthService;

  let usersRepo: jest.Mocked<Repository<User>>;
  let rolesRepo: jest.Mocked<Repository<Role>>;
  let usersService: jest.Mocked<UsersService>;
  let jwt: {
    signAsync: jest.Mock<Promise<string>, [object, unknown?]>;
    verifyAsync: jest.Mock<Promise<TokenPayload>, [string, unknown?]>;
  };
  let cfg: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jwt = {
      // signAsync(payload, options?) -> string
      signAsync: jest.fn<Promise<string>, [object, unknown?]>(),
      // verifyAsync(token, options?) -> payload
      verifyAsync: jest.fn<Promise<TokenPayload>, [string, unknown?]>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          } satisfies Partial<jest.Mocked<Repository<User>>>,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: {
            findOne: jest.fn(),
          } satisfies Partial<jest.Mocked<Repository<Role>>>,
        },
        {
          provide: UsersService,
          useValue: {
            getMe: jest.fn(),
          } satisfies Partial<jest.Mocked<UsersService>>,
        },
        {
          provide: JwtService,
          useValue: jwt,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          } satisfies Partial<jest.Mocked<ConfigService>>,
        },
      ],
    }).compile();

    service = module.get(AuthService);

    usersRepo = module.get(getRepositoryToken(User));
    rolesRepo = module.get(getRepositoryToken(Role));
    usersService = module.get(UsersService);
    cfg = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------
  // login
  // -------------------------
  describe('login', () => {
    it('login OK: valida password, emite sesión y retorna user', async () => {
      const qb = makeUserQB();

      const user = {
        id: 'u1',
        name: 'Flor',
        email: 'a@a.com',
        isActive: true,
        password: 'hash_pw',
        role: { code: 'BLOGGER' } as Role,
      } as unknown as User;

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // issueSession: en tu service se llama a jwt.signAsync 2 veces
      jwt.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      // saveRefreshToken() -> usersRepo.update(...)
      usersRepo.update.mockResolvedValue(updateResult(1));

      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        if (key === 'BCRYPT_SALT_ROUNDS') return '12';
        if (key === 'JWT_REFRESH_EXPIRES_DAYS') return '7';
        return undefined;
      });

      // hash(refreshToken) para guardar refreshTokenHash
      (
        bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('stored_refresh_hash');

      const dto: LoginDto = { email: 'a@a.com', password: 'pw' };

      const res = await service.login(dto);

      expect(usersRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(qb.addSelect).toHaveBeenCalledWith('user.password');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.role', 'role');
      expect(qb.where).toHaveBeenCalledWith('user.email = :email', {
        email: dto.email,
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, user.password);

      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(usersRepo.update).toHaveBeenCalledWith(
        { id: 'u1' },
        expect.objectContaining({
          refreshTokenHash: 'stored_refresh_hash',
          refreshTokenExpiresAt: expect.any(Date),
        }),
      );

      expect(res).toEqual({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: {
          id: 'u1',
          name: 'Flor',
          email: 'a@a.com',
          role: 'BLOGGER',
          isActive: true,
        },
      });
    });

    it('si no existe el user: Unauthorized', async () => {
      const qb = makeUserQB();
      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(null);

      const dto: LoginDto = { email: 'x@x.com', password: 'pw' };

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('si está deshabilitado: Forbidden', async () => {
      const qb = makeUserQB();

      const user = {
        id: 'u1',
        email: 'a@a.com',
        isActive: false,
        password: 'hash_pw',
        role: { code: 'BLOGGER' } as Role,
      } as unknown as User;

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      const dto: LoginDto = { email: 'a@a.com', password: 'pw' };

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('si password no coincide: Unauthorized', async () => {
      const qb = makeUserQB();

      const user = {
        id: 'u1',
        email: 'a@a.com',
        isActive: true,
        password: 'hash_pw',
        role: { code: 'BLOGGER' } as Role,
      } as unknown as User;

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      (
        bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>
      ).mockResolvedValue(false);

      const dto: LoginDto = { email: 'a@a.com', password: 'bad' };

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // -------------------------
  // register
  // -------------------------
  describe('register', () => {
    it('register OK: normaliza email/name, asigna BLOGGER, guarda y emite sesión', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const bloggerRole = {
        id: 'r1',
        code: 'BLOGGER',
        name: 'blogger',
      } as Role;
      rolesRepo.findOne
        .mockResolvedValueOnce(bloggerRole) // por code
        .mockResolvedValueOnce(null); // por name (no debería usarse)

      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        if (key === 'BCRYPT_SALT_ROUNDS') return '12';
        if (key === 'JWT_REFRESH_EXPIRES_DAYS') return '7';
        return undefined;
      });

      (bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>)
        // password hash
        .mockResolvedValueOnce('pw_hash')
        // refresh token hash (saveRefreshToken)
        .mockResolvedValueOnce('stored_refresh_hash');

      jwt.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      usersRepo.update.mockResolvedValue(updateResult(1));

      const createdUser = {
        id: 'u1',
        name: 'Flor',
        email: 'a@a.com',
        isActive: true,
        role: bloggerRole,
      } as unknown as User;

      usersRepo.create.mockReturnValue(createdUser);
      usersRepo.save.mockResolvedValue(createdUser);

      const dto: RegisterDto = {
        name: '  Flor ',
        email: 'A@A.COM',
        password: '12345678',
      };

      const res = await service.register(dto);

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'a@a.com' },
      });

      expect(rolesRepo.findOne).toHaveBeenCalledWith({
        where: { code: 'BLOGGER' },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('12345678', 12);

      expect(usersRepo.create).toHaveBeenCalledWith({
        name: 'Flor',
        email: 'a@a.com',
        password: 'pw_hash',
        isActive: true,
        role: bloggerRole,
      });

      expect(usersRepo.save).toHaveBeenCalled();
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(usersRepo.update).toHaveBeenCalled(); // save refresh hash

      expect(res).toEqual({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: {
          id: 'u1',
          name: 'Flor',
          email: 'a@a.com',
          role: 'BLOGGER',
          isActive: true,
        },
      });
    });

    it('si email ya existe: Conflict', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' } as User);

      const dto: RegisterDto = {
        name: 'Flor',
        email: 'a@a.com',
        password: '12345678',
      };

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('si falta rol BLOGGER: InternalServerError', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      rolesRepo.findOne.mockResolvedValue(null);

      const dto: RegisterDto = {
        name: 'Flor',
        email: 'a@a.com',
        password: '12345678',
      };

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // -------------------------
  // refresh
  // -------------------------
  describe('refresh', () => {
    it('si falta JWT_REFRESH_SECRET: InternalServerError', async () => {
      cfg.get.mockReturnValue(undefined);

      await expect(service.refresh('rt')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('si verifyAsync falla: Unauthorized', async () => {
      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        return undefined;
      });

      jwt.verifyAsync.mockRejectedValue(new Error('bad token'));

      await expect(service.refresh('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('si user no existe: Unauthorized', async () => {
      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        return undefined;
      });

      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', role: 'BLOGGER' });

      const qb = makeUserQB();
      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(null);

      await expect(service.refresh('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refresh OK: valida firma + expiración + hash, rota tokens y persiste nuevo refresh', async () => {
      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        if (key === 'BCRYPT_SALT_ROUNDS') return '12';
        if (key === 'JWT_REFRESH_EXPIRES_DAYS') return '7';
        return undefined;
      });

      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', role: 'BLOGGER' });

      const qb = makeUserQB();

      const user = {
        id: 'u1',
        isActive: true,
        role: { code: 'BLOGGER' } as Role,
        refreshTokenHash: 'stored_hash',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      } as unknown as User;

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      (
        bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>
      ).mockResolvedValue(true);

      jwt.signAsync
        .mockResolvedValueOnce('new_access')
        .mockResolvedValueOnce('new_refresh');

      (
        bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('new_refresh_hash');

      usersRepo.update.mockResolvedValue(updateResult(1));

      const res = await service.refresh('rt');

      expect(jwt.verifyAsync).toHaveBeenCalledWith('rt', {
        secret: 'refresh_secret',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('rt', 'stored_hash');

      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(usersRepo.update).toHaveBeenCalledWith(
        { id: 'u1' },
        expect.objectContaining({
          refreshTokenHash: 'new_refresh_hash',
          refreshTokenExpiresAt: expect.any(Date),
        }),
      );

      expect(res).toEqual({
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
      });
    });

    it('si refreshTokenExpiresAt falta o expira: Unauthorized', async () => {
      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        return undefined;
      });

      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', role: 'BLOGGER' });

      const qb = makeUserQB();

      const user = {
        id: 'u1',
        isActive: true,
        role: { code: 'BLOGGER' } as Role,
        refreshTokenHash: 'stored_hash',
        refreshTokenExpiresAt: new Date(Date.now() - 1000),
      } as unknown as User;

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      await expect(service.refresh('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('si refreshTokenHash falta: Unauthorized', async () => {
      cfg.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        return undefined;
      });

      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', role: 'BLOGGER' });

      const qb = makeUserQB();

      const user = {
        id: 'u1',
        isActive: true,
        role: { code: 'BLOGGER' } as Role,
        refreshTokenHash: null,
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      } as unknown as User;

      usersRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<User>,
      );
      qb.getOne.mockResolvedValue(user);

      await expect(service.refresh('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // -------------------------
  // me / logout
  // -------------------------
  describe('me', () => {
    it('delegates a UsersService.getMe', async () => {
      const user = { id: 'u1', name: 'Flor' } as User;
      usersService.getMe.mockResolvedValue(user);

      const res = await service.me('u1');

      expect(usersService.getMe).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ user });
    });
  });

  describe('logout', () => {
    it('limpia refreshTokenHash y refreshTokenExpiresAt', async () => {
      usersRepo.update.mockResolvedValue(updateResult(1));

      const res = await service.logout('u1');

      expect(usersRepo.update).toHaveBeenCalledWith(
        { id: 'u1' },
        { refreshTokenHash: null, refreshTokenExpiresAt: null },
      );
      expect(res).toEqual({ ok: true });
    });
  });
});
