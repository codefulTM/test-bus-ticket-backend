import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { Bus } from './bus.entity';
import { Route } from './route.entity';

export enum OperatorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
}

@Entity('operators')
@Index('idx_operators_name_status', ['name', 'status'])
export class Operator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index('idx_operators_name')
  name: string;

  @Column({ name: 'contact_email', unique: true })
  @Index('idx_operators_email')
  contactEmail: string;

  @Column({ name: 'contact_phone' })
  contactPhone: string;

  @Column({
    type: 'enum',
    enum: OperatorStatus,
    default: OperatorStatus.PENDING,
  })
  @Index('idx_operators_status')
  status: OperatorStatus;

  @Column({ name: 'approved_at', nullable: true, type: 'timestamp with time zone' })
  approvedAt: Date;

  // Relations
  @OneToMany(() => Bus, (bus) => bus.operator)
  buses: Bus[];

  @OneToMany(() => Route, (route) => route.operator)
  routes: Route[];
}
