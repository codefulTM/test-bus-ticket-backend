import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatStatusController } from './seat-status.controller';
import { SeatStatusService } from './seat-status.service';
import { SeatStatus } from '../entities/seat-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SeatStatus])],
  controllers: [SeatStatusController],
  providers: [SeatStatusService],
  exports: [SeatStatusService],
})
export class SeatStatusModule {}
