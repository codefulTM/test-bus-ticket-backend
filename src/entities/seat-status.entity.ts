import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Trip } from './trip.entity';
import { Seat } from './seat.entity';
import { Booking } from './booking.entity';

export enum SeatState {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  LOCKED = 'locked',
  RESERVED = 'reserved',
}

@Entity('seat_status')
export class SeatStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id' })
  tripId: string;

  @Column({ name: 'seat_id' })
  seatId: string;

  @Column({ name: 'booking_id', nullable: true })
  bookingId: string | null;

  @Column({
    type: 'enum',
    enum: SeatState,
    default: SeatState.AVAILABLE,
  })
  state: SeatState;

  @Column({
    name: 'locked_until',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lockedUntil: Date | null;

  // Relations
  @ManyToOne(() => Trip, (trip) => trip.seatStatuses)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => Seat, (seat) => seat.seatStatuses)
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;

  @ManyToOne(() => Booking, (booking) => booking.seatStatuses, {
    nullable: true,
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;
}
