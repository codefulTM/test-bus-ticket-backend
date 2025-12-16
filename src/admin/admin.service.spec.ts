// src/admin/admin.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

type RepoFindFn<T> = jest.Mock<Promise<T[]>, []>;
type RepoFindOneFn<T> = jest.Mock<
  Promise<T | null>,
  [Partial<Record<keyof T, unknown>>?]
>;
type RepoSaveFn<T> = jest.Mock<Promise<T>, [Partial<T>]>;

type UserRepoMock = {
  find: RepoFindFn<User>;
  findOne: RepoFindOneFn<User>;
  save: RepoSaveFn<User>;
};

type AuditRepoMock = {
  save: RepoSaveFn<AuditLog>;
};

describe('AdminService', () => {
  let service: AdminService;

  const usersFixture: User[] = [
    {
      id: 'u1',
      name: 'User1',
      email: 'u1@x.com',
      phone: '0912345678',
    } as User,
  ];

  // Create mocks with explicit generics so their types are exact (no "any")
  const usersRepoMock: UserRepoMock = {
    find: jest.fn<Promise<User[]>, []>(() => Promise.resolve([])),
    findOne: jest.fn<
      Promise<User | null>,
      [Partial<Record<keyof User, unknown>>?]
    >(() => Promise.resolve(null)),
    save: jest.fn<Promise<User>, [Partial<User>]>(() =>
      Promise.resolve(usersFixture[0]),
    ),
  };

  const auditRepoMock: AuditRepoMock = {
    save: jest.fn<Promise<AuditLog>, [Partial<AuditLog>]>(() =>
      Promise.resolve({
        id: 'a1',
        actorId: 'actor1',
        targetUserId: 'u1',
        action: 'CHANGE_ROLE',
        details: 'role -> ADMIN',
        metadata: { by: 'actor1', at: new Date().toISOString() },
        createdAt: new Date(),
      } as AuditLog),
    ),
  };

  beforeEach(async () => {
    // reset call history and set default behaviors as needed per-test
    usersRepoMock.find.mockReset();
    usersRepoMock.findOne.mockReset();
    usersRepoMock.save.mockReset();
    auditRepoMock.save.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepoMock },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('findAllUsers returns sanitized array', async () => {
    usersRepoMock.find.mockResolvedValueOnce(usersFixture);

    const res = await service.findAllUsers();

    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toHaveProperty('userId', usersFixture[0].id);
    expect(res[0]).toHaveProperty('email', usersFixture[0].email);
    expect(usersRepoMock.find).toHaveBeenCalledTimes(1);
  });

  it('updateUserRole updates role and writes audit', async () => {
    const updatedUser = {
      ...usersFixture[0],
      role: 'ADMIN',
    } as unknown as User;

    usersRepoMock.findOne.mockResolvedValueOnce(usersFixture[0]);
    usersRepoMock.save.mockResolvedValueOnce(updatedUser);
    auditRepoMock.save.mockResolvedValueOnce({
      id: 'a1',
      actorId: 'actor1',
      targetUserId: 'u1',
      action: 'CHANGE_ROLE',
      details: 'role -> ADMIN',
      metadata: { by: 'actor1', at: new Date().toISOString() },
      createdAt: new Date(),
    } as AuditLog);

    const result = await service.updateUserRole('u1', 'ADMIN', 'actor1');

    expect(usersRepoMock.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(usersRepoMock.save).toHaveBeenCalled();
    expect(auditRepoMock.save).toHaveBeenCalled();

    expect(result).toHaveProperty('role', 'ADMIN');
    expect(result).toHaveProperty('id', 'u1');
  });
});
