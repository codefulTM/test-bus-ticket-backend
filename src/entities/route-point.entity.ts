import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Route } from './route.entity';

export enum PointType {
  PICKUP = 'pickup',
  DROPOFF = 'dropoff',
  BOTH = 'both'
}

@Entity('route_points')
export class RoutePoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  longitude: number;

  @Column({ type: 'enum', enum: PointType, default: PointType.BOTH })
  type: PointType;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'int', nullable: true })
  distanceFromStart: number; // in meters

  @Column({ type: 'int', nullable: true })
  estimatedTimeFromStart: number; // in minutes

  @ManyToOne(() => Route, route => route.points, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column()
  routeId: string;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
