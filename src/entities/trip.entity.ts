import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Route } from './route.entity';
import { Bus } from './bus.entity';
import { Booking } from './booking.entity';
import { SeatStatus } from './seat-status.entity';
import { Feedback } from './feedback.entity';

export enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELAYED = 'delayed',
}

@Entity('trips')
@Index('idx_trips_route_departure', ['routeId', 'departureTime'])
@Index('idx_trips_bus_departure', ['busId', 'departureTime'])
@Index('idx_trips_status_departure', ['status', 'departureTime'])
@Index('idx_trips_departure_time', ['departureTime'])
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id' })
  @Index('idx_trips_route_id')
  routeId: string;

  @Column({ name: 'bus_id' })
  @Index('idx_trips_bus_id')
  busId: string;

  @Column({ name: 'departure_time', type: 'timestamp with time zone' })
  departureTime: Date;

  @Column({ name: 'arrival_time', type: 'timestamp with time zone' })
  @Index('idx_trips_arrival_time')
  arrivalTime: Date;

  @Column({ name: 'base_price' })
  basePrice: number;

  @Column({
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.SCHEDULED,
  })
  @Index('idx_trips_status')
  status: TripStatus;

  // Relations
  @ManyToOne(() => Route, (route) => route.trips)
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @ManyToOne(() => Bus, (bus) => bus.trips)
  @JoinColumn({ name: 'bus_id' })
  bus: Bus;

  @OneToMany(() => Booking, (booking) => booking.trip)
  bookings: Booking[];

  @OneToMany(() => SeatStatus, (seatStatus) => seatStatus.trip)
  seatStatuses: SeatStatus[];

  @OneToMany(() => Feedback, (feedback) => feedback.trip)
  feedbacks: Feedback[];
}
