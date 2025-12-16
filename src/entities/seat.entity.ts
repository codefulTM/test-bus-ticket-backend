import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Bus } from './bus.entity';
import { SeatStatus } from './seat-status.entity';

export enum SeatType {
  NORMAL = 'normal',
  VIP = 'vip',
  BUSINESS = 'business',
}

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bus_id' })
  busId: string;

  @Column({ name: 'seat_code' })
  seatCode: string;

  @Column({
    type: 'enum',
    enum: SeatType,
    default: SeatType.NORMAL,
  })
  seatType: SeatType;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Bus, (bus) => bus.seats)
  @JoinColumn({ name: 'bus_id' })
  bus: Bus;

  @OneToMany(() => SeatStatus, (seatStatus) => seatStatus.seat)
  seatStatuses: SeatStatus[];
}
