import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Trip } from './trip.entity';
import { PassengerDetail } from './passenger-detail.entity';
import { SeatStatus } from './seat-status.entity';
import { Payment } from './payment.entity';
import { Notification } from './notification.entity';

export enum BookingStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled', 
  EXPIRED = 'expired',
}

@Entity('bookings')
@Index('idx_bookings_user_trip', ['userId', 'tripId'])
@Index('idx_bookings_trip_status', ['tripId', 'status'])
@Index('idx_bookings_user_status', ['userId', 'status'])
@Index('idx_bookings_booked_at', ['bookedAt'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_reference', unique: true })
  bookingReference: string;

  @Column({ name: 'user_id', nullable: true })
  @Index('idx_bookings_user_id')
  userId?: string;

  @Column({ name: 'trip_id' })
  @Index('idx_bookings_trip_id')
  tripId: string;

  @Column({ name: 'total_amount' })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  @Index('idx_bookings_status')
  status: BookingStatus;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail?: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone?: string;

  @CreateDateColumn({ name: 'booked_at', type: 'timestamp with time zone' })
  bookedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamp with time zone', nullable: true })
  cancelledAt?: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Trip, (trip) => trip.bookings)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @OneToMany(
    () => PassengerDetail,
    (passengerDetail) => passengerDetail.booking,
  )
  passengerDetails: PassengerDetail[];

  @OneToMany(() => SeatStatus, (seatStatus) => seatStatus.booking)
  seatStatuses: SeatStatus[];

  @OneToMany(() => Payment, (payment) => payment.booking)
  payments: Payment[];

  @OneToMany(() => Notification, (notification) => notification.booking)
  notifications: Notification[];
}
