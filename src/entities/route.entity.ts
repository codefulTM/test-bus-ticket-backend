import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Operator } from './operator.entity';
import { Trip } from './trip.entity';
import { RoutePoint } from './route-point.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ name: 'origin' })
  origin: string;

  @Column({ name: 'destination' })
  destination: string;

  @Column({ name: 'distance_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  distanceKm: number;

  @Column({ name: 'estimated_minutes', nullable: true })
  estimatedMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  amenities: string[];

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => RoutePoint, point => point.route, { cascade: true })
  points: RoutePoint[];

  // Relations
  @ManyToOne(() => Operator, (operator) => operator.routes, { nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;

  @OneToMany(() => Trip, (trip) => trip.route)
  trips: Trip[];
}
