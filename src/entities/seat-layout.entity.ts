import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Bus } from './bus.entity';

export enum SeatLayoutType {
  STANDARD_2X2 = 'standard_2x2',
  STANDARD_2X3 = 'standard_2x3',
  VIP_1X2 = 'vip_1x2',
  SLEEPER_1X2 = 'sleeper_1x2',
  CUSTOM = 'custom',
}

@Entity('seat_layouts')
@Index('idx_seat_layouts_bus_type', ['busId', 'layoutType'])
@Index('idx_seat_layouts_created_at', ['createdAt'])
export class SeatLayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bus_id' })
  @Index('idx_seat_layouts_bus_id')
  busId: string;

  @Column({
    type: 'enum',
    enum: SeatLayoutType,
    default: SeatLayoutType.STANDARD_2X2,
  })
  @Index('idx_seat_layouts_type')
  layoutType: SeatLayoutType;

  @Column({ name: 'total_rows' })
  totalRows: number;

  @Column({ name: 'seats_per_row' })
  seatsPerRow: number;

  @Column({ name: 'layout_config', type: 'json' })
  layoutConfig: SeatLayoutConfig;

  @Column({ name: 'seat_pricing', type: 'json' })
  seatPricing: SeatPricingConfig;

  @Column({ name: 'created_at', type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Bus, (bus) => bus.seatLayout)
  @JoinColumn({ name: 'bus_id' })
  bus: Bus;
}

export interface SeatPosition {
  row: number;
  position: number; // Position in row (1, 2, 3, etc.)
  x: number; // X coordinate for visual positioning
  y: number; // Y coordinate for visual positioning
  width: number; // Width of seat
  height: number; // Height of seat
}

export interface SeatInfo {
  id: string;
  code: string;
  type: 'normal' | 'vip' | 'business';
  position: SeatPosition;
  isAvailable: boolean;
  price?: number;
}

export interface SeatLayoutConfig {
  seats: SeatInfo[];
  aisles: number[]; // Positions where aisles exist
  dimensions: {
    totalWidth: number;
    totalHeight: number;
    seatWidth: number;
    seatHeight: number;
    aisleWidth: number;
    rowSpacing: number;
  };
}

export interface SeatPricingConfig {
  basePrice: number;
  seatTypePrices: {
    normal: number;
    vip: number;
    business: number;
  };
  rowPricing?: {
    [rowNumber: number]: number; // Additional price per row
  };
  positionPricing?: {
    [position: string]: number; // Additional price per position (window, aisle, etc.)
  };
}
