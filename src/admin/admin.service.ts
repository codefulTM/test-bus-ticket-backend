import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(AuditLog) private auditRepository: Repository<AuditLog>,
  ) {}

  async findAllUsers() {
    const users = await this.usersRepository.find();

    const sanitized = users.map((u) => ({
      userId: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
    }));

    return sanitized;
  }

  async updateUserRole(userId: string, newRole: string, actorId?: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.role = newRole as UserRole;
    await this.usersRepository.save(user);

    await this.auditRepository.save({
      actorId,
      targetUserId: userId,
      action: 'CHANGE_ROLE',
      details: `role -> ${newRole}`,
      metadata: { by: actorId, at: new Date().toISOString() },
    });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
