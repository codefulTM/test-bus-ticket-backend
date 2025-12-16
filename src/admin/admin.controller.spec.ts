import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import type { Request } from 'express';
import { ChangeRoleDto } from './dto/change-role.dto';

describe('AdminController', () => {
  let controller: AdminController;

  type SanitizedUser = {
    userId: string;
    email: string;
    fullName?: string;
    role: string;
    createdAt?: Date;
  };

  // Strongly-typed mock for AdminService
  const mockAdminService: Partial<AdminService> = {
    findAllUsers: jest.fn().mockResolvedValue([
      {
        userId: 'u1',
        email: 'alice@example.com',
        fullName: 'Alice',
        role: 'CUSTOMER',
        createdAt: new Date(),
      },
    ] as SanitizedUser[]),

    // Return a Promise (mockResolvedValue) instead of async function without await
    updateUserRole: jest
      .fn()
      .mockImplementation((userId: string, newRole: string) =>
        Promise.resolve({
          id: userId,
          email: `${userId}@example.com`,
          name: `User ${userId}`,
          role: newRole,
        }),
      ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return array of sanitized users', async () => {
      const res = await controller.getAllUsers();
      expect(Array.isArray(res)).toBe(true);
      expect((res as SanitizedUser[]).length).toBeGreaterThan(0);
      expect((res as SanitizedUser[])[0]).toHaveProperty('userId');
      expect(
        (mockAdminService.findAllUsers as jest.Mock).mock.calls.length,
      ).toBe(1);
    });
  });

  describe('changeUserRole', () => {
    it('should call adminService.updateUserRole and return ok true with updated user', async () => {
      const dto: ChangeRoleDto = { role: 'admin' } as ChangeRoleDto;
      const request = {
        user: { sub: 'actor-123' },
      } as Request & { user?: { sub?: string } };

      const result = await controller.changeUserRole('u1', dto, request);

      // ensure mock was called with actor id
      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
        'u1',
        'admin',
        'actor-123',
      );

      // type the result when asserting .updated to avoid unsafe-member-access
      type ChangeResult = { ok: true; updated: { id: string; role: string } };
      const typed = result as unknown as ChangeResult;

      expect(typed.ok).toBe(true);
      expect(typed.updated).toBeDefined();
      expect(typed.updated.id).toBe('u1');
      expect(typed.updated.role).toBe('admin');
    });

    it('should pass undefined actorId if req.user missing', async () => {
      const dto: ChangeRoleDto = { role: 'operator' } as ChangeRoleDto;
      const request = {} as Request & { user?: { sub?: string } };

      // To ensure linter doesn't complain about unused actor param in mock, explicitly reference it
      // inside mock implementation we didn't reference actorId; that's fine because call still passes undefined.

      const result = await controller.changeUserRole('u2', dto, request);

      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
        'u2',
        'operator',
        undefined,
      );

      const typed = result as unknown as { ok: true; updated: { id: string } };
      expect(typed.ok).toBe(true);
      expect(typed.updated.id).toBe('u2');
    });
  });
});
