import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayosService } from './payos.service';
import { PayosController } from './payos.controller';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../entities/booking.entity';
import { SeatStatus } from '../entities/seat-status.entity';
import { SeatStatusGateway } from '../gateways/seat-status.gateway';
import { BookingGateway } from '../gateways/booking.gateway';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking, SeatStatus]),
  ],
  controllers: [PayosController],
  providers: [PayosService, SeatStatusGateway, BookingGateway],
  exports: [PayosService],
})
export class PayosModule {}
