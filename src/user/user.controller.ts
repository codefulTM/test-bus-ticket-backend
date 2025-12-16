import { Controller, Get, Query, Request, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../entities/booking.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('me/bookings')
  @HttpCode(HttpStatus.OK)
  async getUserBookings(
    @Request() req: any,
    @Query('status') status?: BookingStatus,
  ): Promise<{
    success: boolean;
    message: string;
    data: any[];
  }> {
    try {
      const userId = req.user.userId;
      const bookings = await this.bookingService.findBookingsByUserWithDetails(userId, status);
      
      return {
        success: true,
        message: 'User bookings retrieved successfully',
        data: bookings,
      };
    } catch (error) {
      throw error;
    }
  }
}