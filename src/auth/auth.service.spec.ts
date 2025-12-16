// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { JwtConfigService } from '../config/jwt.config.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

type RepoFindOneFn<T> = jest.Mock<
  Promise<T | null>,
  [Partial<Record<keyof T, unknown>>?]
>;
type RepoSaveFn<T> = jest.Mock<Promise<T>, [Partial<T>]>;
type RepoCreateFn<T> = jest.Mock<Partial<T>, [Partial<T>]>;

interface UserRepoMock {
  findOne: RepoFindOneFn<User>;
  save: RepoSaveFn<User>;
  create: RepoCreateFn<User>;
}

interface RefreshRepoMock {
  findOne: RepoFindOneFn<RefreshToken>;
  save: RepoSaveFn<RefreshToken>;
  create: RepoCreateFn<RefreshToken>;
}

describe('AuthService', () => {
  let service: AuthService;

  const usersFixture: User[] = [
    {
      id: '1',
      email: 'a@x.com',
      name: 'A',
      phone: '0912345678',
    } as User,
  ];

  // Create mocks with explicit generics so their types are exact (no "any")
  const usersRepoMock: UserRepoMock = {
    findOne: jest.fn<
      Promise<User | null>,
      [Partial<Record<keyof User, unknown>>?]
    >(() => Promise.resolve(null)),
    save: jest.fn<Promise<User>, [Partial<User>]>(() =>
      Promise.resolve(usersFixture[0]),
    ),
    create: jest.fn<Partial<User>, [Partial<User>]>(
      (dto: Partial<User>) => dto as User,
    ),
  };

  const refreshRepoMock: RefreshRepoMock = {
    findOne: jest.fn<
      Promise<RefreshToken | null>,
      [Partial<Record<keyof RefreshToken, unknown>>?]
    >(() => Promise.resolve(null)),
    save: jest.fn<Promise<RefreshToken>, [Partial<RefreshToken>]>(() =>
      Promise.resolve({
        id: 'rt1',
        userId: '1',
      } as RefreshToken),
    ),
    create: jest.fn<Partial<RefreshToken>, [Partial<RefreshToken>]>(
      (dto: Partial<RefreshToken>) => dto as RefreshToken,
    ),
  };

  const jwtServiceMock: Pick<JwtService, 'sign' | 'verify' | 'decode'> = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const jwtConfigMock: JwtConfigService = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenExpiration: '1h',
    refreshTokenExpiration: '7d',
    getExpirationInSeconds: () => 3600,
  } as unknown as JwtConfigService;

  beforeEach(async () => {
    usersRepoMock.findOne.mockReset();
    usersRepoMock.save.mockReset();
    refreshRepoMock.findOne.mockReset();
    refreshRepoMock.save.mockReset();

    // bcrypt mocks
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockImplementation((val: string) =>
      Promise.resolve(`hashed-${val}`),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshRepoMock,
        },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: JwtConfigService, useValue: jwtConfigMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.resetAllMocks());

  it('login should return tokens and user', async () => {
    usersRepoMock.findOne.mockResolvedValueOnce(usersFixture[0]);

    const loginDto: LoginDto = {
      email: 'a@x.com',
      password: 'password',
    } as LoginDto;

    const result = await service.login(loginDto);

    expect(result.data).toHaveProperty('accessToken', 'signed-token');
    expect(result.data.user.email).toBe('a@x.com');
    expect(jwtServiceMock.sign).toHaveBeenCalled();
  });

  it('login throws on invalid credentials', async () => {
    usersRepoMock.findOne.mockResolvedValueOnce(null);

    const badDto: LoginDto = {
      email: 'nope',
      password: 'bad',
    } as LoginDto;

    await expect(service.login(badDto)).rejects.toThrow();
  });
});
