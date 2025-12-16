import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Put,
  Delete,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { BookingService } from './booking.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { GetGuestBookingDto } from './dto/get-guest-booking.dto';

// Inline DTO to avoid import issues
interface PassengerUpdateDto {
  id: string;
  fullName: string;
  documentId: string;
  seatCode: string;
}

interface UpdatePassengerDto {
  passengers: PassengerUpdateDto[];
}

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingSchedulerService: BookingSchedulerService,
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @Request() req: any,
    @Body() createBookingDto: CreateBookingDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: BookingResponseDto;
  }> {
    try {
      const userId = req.user?.userId ?? null;
      const booking = await this.bookingService.createBooking(
        userId,
        createBookingDto,
      );

      return {
        success: true,
        message: 'Booking created successfully',
        data: booking,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('guest')
  async getGuestBooking(@Query() query: GetGuestBookingDto) {
    const result = await this.bookingService.findBookingByGuest(query);
    return {
      success: true,
      data: result,
      message: 'guest booking retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getBookingDetails(
    @Param('id') bookingId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
    data: any; // Use any for now to avoid type issues
  }> {
    try {
      const booking = await this.bookingService.findBookingById(bookingId);

      // Transform booking for response
      const responseData = {
        id: booking.id,
        userId: booking.userId,
        tripId: booking.tripId,
        reference: booking.bookingReference,
        totalAmount: booking.totalAmount,
        status: booking.status,
        bookedAt: booking.bookedAt,
        cancelledAt: booking.cancelledAt,
        trip: booking.trip
          ? {
              id: booking.trip.id,
              departureTime: booking.trip.departureTime,
              arrivalTime: booking.trip.arrivalTime,
              basePrice: booking.trip.basePrice,
              status: booking.trip.status,
              route: booking.trip.route
                ? {
                    id: booking.trip.route.id,
                    name: booking.trip.route.name,
                    description: booking.trip.route.description,
                    origin: booking.trip.route.origin,
                    destination: booking.trip.route.destination,
                    distanceKm: booking.trip.route.distanceKm,
                    estimatedMinutes: booking.trip.route.estimatedMinutes,
                  }
                : null,
              bus: booking.trip.bus
                ? {
                    id: booking.trip.bus.id,
                    plateNumber: booking.trip.bus.plateNumber,
                    model: booking.trip.bus.model,
                    seatCapacity: booking.trip.bus.seatCapacity,
                  }
                : null,
            }
          : null,
        passengers:
          booking.passengerDetails?.map((p) => ({
            id: p.id,
            fullName: p.fullName,
            documentId: p.documentId,
            seatCode: p.seatCode,
          })) || [],
        seats:
          booking.seatStatuses?.map((s) => ({
            id: s.id,
            seatId: s.seatId,
            state: s.state,
            seat: s.seat
              ? {
                  id: s.seat.id,
                  seatCode: s.seat.seatCode,
                  seatType: s.seat.seatType,
                  isActive: s.seat.isActive,
                }
              : null,
          })) || [],
        expirationTimestamp:
          booking.status === 'pending'
            ? new Date(booking.bookedAt.getTime() + 15 * 60 * 1000)
            : null,
      };

      return {
        success: true,
        message: 'Booking details retrieved successfully',
        data: responseData,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  async getUserBookings(@Request() req: any) {
    const userId = req.user.userId;
    const bookings = await this.bookingService.findBookingsByUser(userId);
    return {
      success: true,
      message: 'User bookings retrieved successfully',
      data: bookings,
    };
  }

  @Put(':id/update')
  @HttpCode(HttpStatus.OK)
  async updatePassengerInfo(
    @Param('id') bookingId: string,
    @Body() updatePassengerDto: UpdatePassengerDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    try {
      const updatedBooking = await this.bookingService.updatePassengerInfo(
        bookingId,
        updatePassengerDto,
        req.user.userId,
      );

      return {
        success: true,
        message: 'Passenger information updated successfully',
        data: updatedBooking,
      };
    } catch (error) {
      throw error;
    }
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBookingByUser(
    @Param('id') bookingId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const result = await this.bookingService.cancelBookingByUser(
        bookingId,
        req.user.userId,
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

  @Put(':id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Param('id') bookingId: string,
    @Body() paymentData?: any,
  ): Promise<{
    success: boolean;
    message: string;
    data: BookingResponseDto;
  }> {
    try {
      const booking = await this.bookingService.confirmPayment(
        bookingId,
        paymentData,
      );

      return {
        success: true,
        message: 'Payment confirmed successfully',
        data: booking,
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id') bookingId: string,
    @Body() body: { reason?: string } = {},
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const result = await this.bookingService.cancelBooking(
        bookingId,
        body.reason,
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

  @Put(':id/expire')
  @HttpCode(HttpStatus.OK)
  async expireBooking(@Param('id') bookingId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const result = await this.bookingService.expireBooking(bookingId);

      return result;
    } catch (error) {
      throw error;
    }
  }

  @Get(':bookingId/eticket')
  async downloadEticket(
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.bookingService.generateEticketFile(bookingId);

    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(buffer);
  }

  @Post(':bookingId/eticket/email')
  @HttpCode(HttpStatus.OK)
  async sendEticketEmail(
    @Param('bookingId') bookingId: string,
    @Body() body: { email?: string } = {},
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.bookingService.sendEticketEmail(
      bookingId,
      body.email,
    );

    return {
      success: result.success,
      message: 'e-ticket email sent successfully',
    };
  }

  // Admin endpoint - Manual cleanup of expired bookings
  @Post('admin/cleanup-expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredBookings(): Promise<{
    success: boolean;
    message: string;
    data: {
      processed: number;
      errors: string[];
    };
  }> {
    try {
      const result = await this.bookingSchedulerService.triggerManualCleanup();

      return {
        success: true,
        message: `Cleanup completed. Processed ${result.processed} expired bookings.`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        data: {
          processed: 0,
          errors: [error.message],
        },
      };
    }
  }
}
