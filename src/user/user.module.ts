import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [BookingModule],
  controllers: [UserController],
})
export class UserModule {}