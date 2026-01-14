import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';

import { PostsService } from './posts.service';
import { PostEntity, PostStatus } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';

type QB = Partial<SelectQueryBuilder<PostEntity>>;

describe('PostsService', () => {
  let service: PostsService;

  // ---- Repo mocks (tipados) ----
  const createQueryBuilderMock = jest.fn();
  const findOneMock = jest.fn();
  const saveMock = jest.fn();
  const createMock = jest.fn(
    (x?: Partial<PostEntity>) => x as PostEntity,
  ) as unknown as jest.MockedFunction<Repository<PostEntity>['create']>;
  const updateMock = jest.fn();

  // ---- QueryBuilder mock ----
  const qb: QB = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    createQueryBuilderMock.mockReturnValue(qb);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(PostEntity),
          useValue: {
            createQueryBuilder: createQueryBuilderMock,
            findOne: findOneMock,
            save: saveMock,
            create: createMock,
            update: updateMock,
          } satisfies Partial<Repository<PostEntity>>,
        },
      ],
    }).compile();

    service = moduleRef.get(PostsService);

    jest.clearAllMocks();
    createQueryBuilderMock.mockReturnValue(qb);
    (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ----------------------------------------------------------------
  // create
  // ----------------------------------------------------------------
  describe('create', () => {
    it('crea un post con defaults y guarda', async () => {
      const dto: CreatePostDto = {
        title: '  Hola  ',
        excerpt: '  Resumen  ',
        content: 'Contenido',
        tags: ['react'],
        status: PostStatus.PUBLISHED,
      };

      const created = {
        title: 'Hola',
        excerpt: 'Resumen',
        content: 'Contenido',
        tags: ['react'],
        status: PostStatus.PUBLISHED,
        coverUrl: null,
        authorId: 'u1',
      } as PostEntity;

      const saved = { ...created, id: 'p1' } as PostEntity;

      createMock.mockReturnValue(created);
      saveMock.mockResolvedValue(saved);

      const res = await service.create('u1', dto);

      expect(createMock).toHaveBeenCalledWith({
        title: 'Hola',
        excerpt: 'Resumen',
        content: 'Contenido',
        tags: ['react'],
        status: PostStatus.PUBLISHED,
        coverUrl: null,
        authorId: 'u1',
      });
      expect(saveMock).toHaveBeenCalledWith(created);
      expect(res).toBe(saved);
    });

    it('si no viene status, default es PUBLISHED; si no viene excerpt, queda null; tags default []', async () => {
      const dto: CreatePostDto = {
        title: 'Hola',
        content: 'Contenido',
      } as CreatePostDto;

      const created = {
        title: 'Hola',
        excerpt: null,
        content: 'Contenido',
        tags: [],
        status: PostStatus.PUBLISHED,
        coverUrl: null,
        authorId: 'u1',
      } as unknown as PostEntity;

      createMock.mockReturnValue(created);
      saveMock.mockResolvedValue(created);

      const res = await service.create('u1', dto);

      expect(createMock).toHaveBeenCalledWith({
        title: 'Hola',
        excerpt: null,
        content: 'Contenido',
        tags: [],
        status: PostStatus.PUBLISHED,
        coverUrl: null,
        authorId: 'u1',
      });
      expect(res).toBe(created);
    });

    it('si se pasa coverUrl, lo persiste', async () => {
      const dto: CreatePostDto = {
        title: 'Hola',
        content: 'Contenido',
      } as CreatePostDto;

      const created = {
        title: 'Hola',
        excerpt: null,
        content: 'Contenido',
        tags: [],
        status: PostStatus.PUBLISHED,
        coverUrl: '/uploads/covers/x.png',
        authorId: 'u1',
      } as unknown as PostEntity;

      createMock.mockReturnValue(created);
      saveMock.mockResolvedValue(created);

      const res = await service.create('u1', dto, '/uploads/covers/x.png');

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ coverUrl: '/uploads/covers/x.png' }),
      );
      expect(res).toBe(created);
    });
  });

  // ----------------------------------------------------------------
  // listPublished
  // ----------------------------------------------------------------
  describe('listPublished', () => {
    it('arma query con status PUBLISHED, paginación y filtros', async () => {
      const query: ListPostsQueryDto = {
        page: 2,
        limit: 5,
        q: 'hola',
        tag: 'ReAcT',
      };

      await service.listPublished(query);

      expect(createQueryBuilderMock).toHaveBeenCalledWith('post');
      expect(qb.leftJoin).toHaveBeenCalledWith('post.author', 'author');
      expect(qb.addSelect).toHaveBeenCalledWith([
        'author.id',
        'author.name',
        'author.email',
      ]);
      expect(qb.where).toHaveBeenCalledWith('post.status = :status', {
        status: PostStatus.PUBLISHED,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('post.created_at', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(5); // (2-1)*5
      expect(qb.take).toHaveBeenCalledWith(5);

      expect(qb.andWhere).toHaveBeenCalledWith('post.title ILIKE :q', {
        q: '%hola%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(':tag = ANY(post.tags)', {
        tag: 'react',
      });

      expect(qb.getManyAndCount).toHaveBeenCalled();
    });

    it('si no hay q/tag, no agrega filtros extra', async () => {
      const query: ListPostsQueryDto = { page: 1, limit: 10 };

      await service.listPublished(query);

      // solo where base (no usa andWhere si no hay q/tag)
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // listMine
  // ----------------------------------------------------------------
  describe('listMine', () => {
    it('arma query con authorId, filtro base not deleted, paginación y filtros', async () => {
      const query: ListPostsQueryDto = {
        page: 1,
        limit: 10,
        q: 'hola',
        tag: 'react',
      };

      await service.listMine('u1', query);

      expect(createQueryBuilderMock).toHaveBeenCalledWith('post');
      expect(qb.leftJoin).toHaveBeenCalledWith('post.author', 'author');
      expect(qb.addSelect).toHaveBeenCalledWith([
        'author.id',
        'author.name',
        'author.email',
      ]);

      expect(qb.where).toHaveBeenCalledWith('post.authorId = :userId', {
        userId: 'u1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('post.status != :deleted', {
        deleted: PostStatus.DELETED,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('post.title ILIKE :q', {
        q: '%hola%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(':tag = ANY(post.tags)', {
        tag: 'react',
      });

      expect(qb.orderBy).toHaveBeenCalledWith('post.created_at', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });

    it('si no hay q/tag, solo aplica el filtro base not deleted', async () => {
      const query: ListPostsQueryDto = { page: 1, limit: 10 };

      await service.listMine('u1', query);

      expect(qb.andWhere).toHaveBeenCalledTimes(1);
      expect(qb.andWhere).toHaveBeenCalledWith('post.status != :deleted', {
        deleted: PostStatus.DELETED,
      });
    });

    it('usa defaults si page/limit no vienen', async () => {
      const query: ListPostsQueryDto = {};

      await service.listMine('u1', query);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  // ----------------------------------------------------------------
  // getById
  // ----------------------------------------------------------------
  describe('getById', () => {
    it('retorna el post si existe y no está deleted', async () => {
      const post = {
        id: 'p1',
        status: PostStatus.PUBLISHED,
        authorId: 'u1',
        author: { id: 'u1', name: 'A', email: 'a@a.com' },
      } as unknown as PostEntity;

      findOneMock.mockResolvedValue(post);

      const res = await service.getById('p1');

      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: 'p1' },
        relations: { author: true },
      });
      expect(res).toBe(post);
    });

    it('si no existe, lanza NotFound', async () => {
      findOneMock.mockResolvedValue(null);

      await expect(service.getById('404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si está DELETED, lanza NotFound', async () => {
      const post = { id: 'p1', status: PostStatus.DELETED } as PostEntity;
      findOneMock.mockResolvedValue(post);

      await expect(service.getById('p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si está DRAFT y no sos el autor, lanza Forbidden', async () => {
      const post = {
        id: 'p1',
        status: PostStatus.DRAFT,
        authorId: 'owner',
      } as PostEntity;

      findOneMock.mockResolvedValue(post);

      await expect(service.getById('p1', 'otro')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('si está DRAFT y sos el autor, lo retorna', async () => {
      const post = {
        id: 'p1',
        status: PostStatus.DRAFT,
        authorId: 'u1',
      } as PostEntity;

      findOneMock.mockResolvedValue(post);

      const res = await service.getById('p1', 'u1');
      expect(res).toBe(post);
    });
  });

  // ----------------------------------------------------------------
  // updateMine
  // ----------------------------------------------------------------
  describe('updateMine', () => {
    it('si no encuentra post del user, lanza NotFound', async () => {
      findOneMock.mockResolvedValue(null);

      const dto: UpdatePostDto = { title: 'Nuevo' } as UpdatePostDto;

      await expect(service.updateMine('u1', 'p1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: 'p1', authorId: 'u1' },
      });
    });

    it('actualiza campos según dto y guarda', async () => {
      const post = {
        id: 'p1',
        authorId: 'u1',
        title: 'Viejo',
        excerpt: null,
        content: 'C',
        tags: [],
        status: PostStatus.DRAFT,
        coverUrl: null,
      } as unknown as PostEntity;

      findOneMock.mockResolvedValue(post);
      saveMock.mockResolvedValue(post);

      const dto: UpdatePostDto = {
        title: '  Nuevo  ',
        excerpt: '  Ex  ',
        content: 'Nuevo contenido',
        tags: ['react'],
        status: PostStatus.PUBLISHED,
      } as UpdatePostDto;

      const res = await service.updateMine('u1', 'p1', dto);

      expect(post.title).toBe('Nuevo');
      expect(post.excerpt).toBe('Ex');
      expect(post.content).toBe('Nuevo contenido');
      expect(post.tags).toEqual(['react']);
      expect(post.status).toBe(PostStatus.PUBLISHED);

      expect(saveMock).toHaveBeenCalledWith(post);
      expect(res).toBe(post);
    });

    it('si viene cover file, setea coverUrl con /uploads/covers/:filename', async () => {
      const post = {
        id: 'p1',
        authorId: 'u1',
        coverUrl: null,
      } as PostEntity;

      findOneMock.mockResolvedValue(post);
      saveMock.mockResolvedValue(post);

      const dto: UpdatePostDto = {} as UpdatePostDto;

      const cover = { filename: 'abc.png' } as Express.Multer.File;

      const res = await service.updateMine('u1', 'p1', dto, cover);

      expect(post.coverUrl).toBe('/uploads/covers/abc.png');
      expect(saveMock).toHaveBeenCalledWith(post);
      expect(res).toBe(post);
    });

    it('si NO viene cover y dto.removeCover=true, borra coverUrl', async () => {
      const post = {
        id: 'p1',
        authorId: 'u1',
        coverUrl: '/uploads/covers/old.png',
      } as PostEntity;

      findOneMock.mockResolvedValue(post);
      saveMock.mockResolvedValue(post);

      const dto: UpdatePostDto = { removeCover: true } as UpdatePostDto;

      const res = await service.updateMine('u1', 'p1', dto);

      expect(post.coverUrl).toBeNull();
      expect(saveMock).toHaveBeenCalledWith(post);
      expect(res).toBe(post);
    });
  });

  // ----------------------------------------------------------------
  // deleteMine
  // ----------------------------------------------------------------
  describe('deleteMine', () => {
    it('marca el post como DELETED y retorna ok', async () => {
      updateMock.mockResolvedValue({ affected: 1 });

      const res = await service.deleteMine('u1', 'p1');

      expect(updateMock).toHaveBeenCalledWith(
        { id: 'p1', authorId: 'u1' },
        { status: PostStatus.DELETED },
      );
      expect(res).toEqual({ ok: true });
    });

    it('si no afecta filas, lanza NotFound', async () => {
      updateMock.mockResolvedValue({ affected: 0 });

      await expect(service.deleteMine('u1', 'p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
