import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Operator } from './operator.entity';
import { Trip } from './trip.entity';
import { Seat } from './seat.entity';
import { SeatLayout } from './seat-layout.entity';

@Entity('buses')
@Index('idx_buses_operator_model', ['operatorId', 'model'])
@Index('idx_buses_operator_capacity', ['operatorId', 'seatCapacity'])
export class Bus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'operator_id' })
  @Index('idx_buses_operator_id')
  operatorId: string;

  @Column({ name: 'plate_number', unique: true })
  @Index('idx_buses_plate_number') // Additional index for search performance
  plateNumber: string;

  @Column()
  @Index('idx_buses_model')
  model: string;

  @Column({ name: 'seat_capacity' })
  seatCapacity: number;

  @Column({ name: 'amenities_json', type: 'json', nullable: true })
  amenities: string[];

  // Relations
  @ManyToOne(() => Operator, (operator) => operator.buses)
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;

  @OneToMany(() => Trip, (trip) => trip.bus)
  trips: Trip[];

  @OneToMany(() => Seat, (seat) => seat.bus)
  seats: Seat[];

  @OneToOne(() => SeatLayout, (seatLayout) => seatLayout.bus)
  seatLayout: SeatLayout;
}
