import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('passenger_details')
export class PassengerDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'seat_code' })
  seatCode: string;

  // Relations
  @ManyToOne(() => Booking, (booking) => booking.passengerDetails)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
