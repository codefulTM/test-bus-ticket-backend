import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { PassengerDetail } from '../entities/passenger-detail.entity';
import { SeatStatus, SeatState } from '../entities/seat-status.entity';
import { Trip } from '../entities/trip.entity';
import { Seat } from '../entities/seat.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { GetGuestBookingDto } from './dto/get-guest-booking.dto';
import { EmailService } from './email.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(PassengerDetail)
    private passengerDetailRepository: Repository<PassengerDetail>,
    @InjectRepository(SeatStatus)
    private seatStatusRepository: Repository<SeatStatus>,
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,
    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  private async generateBookingReference(): Promise<string> {
    const prefix = 'BK';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    const randomPart = () =>
      Array.from({ length: 6 })
        .map(
          () => chars[Math.floor(Math.random() * chars.length)],
        )
        .join('');

    // Try a few times to avoid collision; DB unique constraint will also protect
    for (let i = 0; i < 10; i++) {
      const code = `${prefix}${datePart}-${randomPart()}`;

      const existing = await this.bookingRepository.findOne({
        where: { bookingReference: code },
      });

      if (!existing) {
        return code;
      }
    }

    // Fallback: still return something; extremely unlikely to collide 10 times
    return `${prefix}${datePart}-${randomPart()}`;
  }

  async createBooking(userId: string | null, createBookingDto: CreateBookingDto): Promise<BookingResponseDto> {
    const { tripId, seats, passengers, totalPrice, isGuestCheckout, contactEmail, contactPhone } = createBookingDto;

    // Start transaction
    return await this.dataSource.transaction(async manager => {
      // 1. Validate trip exists
      const trip = await manager.findOne(Trip, { where: { id: tripId } });
      if (!trip) {
        throw new NotFoundException('Trip not found');
      }

      // 2. Validate seat count matches passenger count
      if (seats.length !== passengers.length) {
        throw new BadRequestException('Number of seats must match number of passengers');
      }

      // 3. Validate seat codes match between seats and passengers
      const seatCodes = seats.map(seat => seat.code).sort();
      const passengerSeatCodes = passengers.map(passenger => passenger.seatCode).sort();
      if (JSON.stringify(seatCodes) !== JSON.stringify(passengerSeatCodes)) {
        throw new BadRequestException('Seat codes in seats and passengers must match');
      }

      // 4. Find seat IDs and validate they exist on the bus
      const seatIds: string[] = [];
      for (const seatDto of seats) {
        const seat = await manager.findOne(Seat, { 
          where: { 
            seatCode: seatDto.code,
            busId: trip.busId
          }
        });
        
        if (!seat) {
          throw new BadRequestException(`Seat ${seatDto.code} not found on this bus`);
        }
        seatIds.push(seat.id);
      }

      // 5. Check seat availability
      const seatStatuses = await manager.find(SeatStatus, {
        where: seatIds.map(seatId => ({
          tripId,
          seatId,
        })),
      });

      // Check if any seats are already booked or locked
      const unavailableSeats = seatStatuses.filter(
        status => status.state === SeatState.BOOKED
      );

      if (unavailableSeats.length > 0) {
        const unavailableCodes = await Promise.all(
          unavailableSeats.map(async (status) => {
            const seat = await manager.findOne(Seat, { where: { id: status.seatId } });
            return seat?.seatCode || status.seatId;
          })
        );
        throw new ConflictException(`Seats ${unavailableCodes.join(', ')} are no longer available`);
      }

      // 6. Create booking with PAID status since payment is bypassed
      const bookingReference = await this.generateBookingReference();
      const bookingData: any = {
        bookingReference,
        tripId,
        totalAmount: totalPrice,
        status: BookingStatus.PAID, // Set to PAID since we're bypassing payment
      };

      if (!isGuestCheckout && userId) {
        bookingData.userId = userId;
      } else {
        bookingData.contactEmail = contactEmail;
        bookingData.contactPhone = contactPhone;
      }

      const booking = manager.create(Booking, bookingData);

      const savedBooking = await manager.save(booking);

      // 7. Create passenger details
      const passengerDetails = passengers.map(passenger => 
        manager.create(PassengerDetail, {
          bookingId: savedBooking.id,
          fullName: passenger.fullName,
          documentId: passenger.documentId,
          seatCode: passenger.seatCode,
        })
      );

      const savedPassengers = await manager.save(passengerDetails);

      // 8. Update/Create seat status to BOOKED
      for (let i = 0; i < seatIds.length; i++) {
        const existingStatus = seatStatuses.find(status => status.seatId === seatIds[i]);
        
        if (existingStatus) {
          // Update existing status
          await manager.update(SeatStatus, existingStatus.id, {
            bookingId: savedBooking.id,
            state: SeatState.BOOKED,
          });
        } else {
          // Create new status
          const newStatus = manager.create(SeatStatus, {
            tripId,
            seatId: seatIds[i],
            bookingId: savedBooking.id,
            state: SeatState.BOOKED,
          });
          await manager.save(newStatus);
        }
      }

      // 9. Set expiration time (null for PAID bookings, they don't expire)
      const expirationTimestamp = null; // PAID bookings don't need expiration

      // 10. Prepare response
      return {
        id: savedBooking.id,
        bookingReference: savedBooking.bookingReference,
        tripId: savedBooking.tripId,
        totalAmount: savedBooking.totalAmount,
        status: savedBooking.status,
        bookedAt: savedBooking.bookedAt,
        expirationTimestamp,
        passengers: savedPassengers.map(passenger => ({
          id: passenger.id,
          fullName: passenger.fullName,
          documentId: passenger.documentId,
          seatCode: passenger.seatCode,
        })),
        seats: seatIds.map((seatId, index) => ({
          seatId,
          seatCode: seats[index].code,
          status: SeatState.BOOKED,
        })),
      };
    });
  }

  async findBookingById(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: [
        'user', 
        'trip', 
        'trip.route',
        'trip.bus', 
        'passengerDetails', 
        'seatStatuses',
        'seatStatuses.seat'
      ],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findBookingsByUser(userId: string): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { userId },
      relations: ['trip', 'passengerDetails', 'seatStatuses'],
      order: { bookedAt: 'DESC' },
    });
  }

  async findBookingByGuest(dto: GetGuestBookingDto) {
    const { contactEmail, contactPhone } = dto;
    
    if (!contactEmail || !contactPhone) {
      throw new BadRequestException({
        success: false,
        error: { message: 'Contact Email and Contact Phone are required'},
        timestamp: new Date().toISOString(),
      });
    }

    const [booking] = await this.bookingRepository.find({
      where: { contactEmail, contactPhone },
      relations: {
        passengerDetails: true,
        trip: true,
      },
      order: { bookedAt: 'DESC' },
      take: 1,
    });

    if (!booking) {
      throw new NotFoundException({
        success: false,
        error: { code: 'BOOK_002', message: 'Booking not found for provided contact info' },
        timestamp: new Date().toISOString(),
      });
    }

    return booking;
  }

  async findBookingsByUserWithDetails(userId: string, status?: BookingStatus): Promise<any[]> {
    // Build the query with proper joins
    const queryBuilder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.bus', 'bus')
      .leftJoinAndSelect('booking.passengerDetails', 'passengerDetails')
      .leftJoinAndSelect('booking.seatStatuses', 'seatStatuses')
      .leftJoinAndSelect('seatStatuses.seat', 'seat')
      .where('booking.userId = :userId', { userId })
      .orderBy('booking.bookedAt', 'DESC');

    // Add status filter if provided
    if (status) {
      queryBuilder.andWhere('booking.status = :status', { status });
    }

    const bookings = await queryBuilder.getMany();

    // Transform the data to include all necessary information
    return bookings.map(booking => ({
      id: booking.id,
      userId: booking.userId,
      tripId: booking.tripId,
      totalAmount: booking.totalAmount,
      status: booking.status,
      bookedAt: booking.bookedAt,
      cancelledAt: booking.cancelledAt,
      expiresAt: booking.status === BookingStatus.PENDING ? 
        new Date(booking.bookedAt.getTime() + 15 * 60 * 1000) : null,
      
      // Trip details
      trip: booking.trip ? {
        id: booking.trip.id,
        departureTime: booking.trip.departureTime,
        arrivalTime: booking.trip.arrivalTime,
        basePrice: booking.trip.basePrice,
        status: booking.trip.status,
        route: booking.trip.route ? {
          id: booking.trip.route.id,
          name: booking.trip.route.name,
          description: booking.trip.route.description,
          origin: booking.trip.route.origin,
          destination: booking.trip.route.destination,
          distanceKm: booking.trip.route.distanceKm,
          estimatedMinutes: booking.trip.route.estimatedMinutes,
        } : null,
        bus: booking.trip.bus ? {
          id: booking.trip.bus.id,
          plateNumber: booking.trip.bus.plateNumber,
          model: booking.trip.bus.model,
          seatCapacity: booking.trip.bus.seatCapacity,
        } : null,
      } : null,
      
      // Passenger details
      passengers: booking.passengerDetails?.map(passenger => ({
        id: passenger.id,
        fullName: passenger.fullName,
        documentId: passenger.documentId,
        seatCode: passenger.seatCode,
      })) || [],
      
      // Seat details
      seats: booking.seatStatuses?.map(seatStatus => ({
        id: seatStatus.id,
        seatId: seatStatus.seatId,
        state: seatStatus.state,
        lockedUntil: seatStatus.lockedUntil,
        seat: seatStatus.seat ? {
          id: seatStatus.seat.id,
          seatCode: seatStatus.seat.seatCode,
          seatType: seatStatus.seat.seatType,
          isActive: seatStatus.seat.isActive,
        } : null,
      })) || [],
    }));
  }

  async confirmPayment(bookingId: string, paymentData?: any): Promise<BookingResponseDto> {
    return await this.dataSource.transaction(async manager => {
      // 1. Find booking
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['passengerDetails', 'seatStatuses'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // 2. Validate booking status
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException(
          `Cannot confirm payment for booking with status: ${booking.status}`,
        );
      }

      // 3. Check if booking has expired (optional business rule)
      const expirationTime = new Date(booking.bookedAt);
      expirationTime.setMinutes(expirationTime.getMinutes() + 15);
      
      if (new Date() > expirationTime) {
        // Auto-cancel expired booking
        await this.cancelBooking(bookingId, 'Booking expired');
        throw new BadRequestException('Booking has expired and been cancelled');
      }

      // 4. Update booking status to PAID
      await manager.update(Booking, bookingId, {
        status: BookingStatus.PAID,
      });

      // 5. Get updated booking
      const updatedBooking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['passengerDetails', 'seatStatuses'],
      });

      if (!updatedBooking) {
        throw new NotFoundException('Updated booking not found');
      }

      // 6. Prepare response
      const seatStatuses = updatedBooking.seatStatuses || [];
      
      return {
        id: updatedBooking.id,
        tripId: updatedBooking.tripId,
        totalAmount: updatedBooking.totalAmount,
        status: updatedBooking.status,
        bookedAt: updatedBooking.bookedAt,
        expirationTimestamp: null, // No expiration for PAID bookings
        passengers: updatedBooking.passengerDetails.map(passenger => ({
          id: passenger.id,
          fullName: passenger.fullName,
          documentId: passenger.documentId,
          seatCode: passenger.seatCode,
        })),
        seats: seatStatuses.map(status => ({
          seatId: status.seatId,
          seatCode: '', // Will be populated if needed
          status: status.state,
        })),
      };
    });
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    return await this.dataSource.transaction(async manager => {
      // 1. Find booking
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['seatStatuses'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // 2. Validate booking status
      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      if (booking.status === BookingStatus.PAID) {
        throw new BadRequestException(
          'Cannot cancel a paid booking. Please contact customer service for refund.',
        );
      }

      // 3. Update booking status to CANCELLED
      await manager.update(Booking, bookingId, {
        status: BookingStatus.CANCELLED,
      });

      // 4. Release seats - update seat statuses back to AVAILABLE
      const seatStatuses = booking.seatStatuses || [];
      for (const seatStatus of seatStatuses) {
        await manager.update(SeatStatus, seatStatus.id, {
          bookingId: null,
          state: SeatState.AVAILABLE,
        });
      }

      return {
        success: true,
        message: reason 
          ? `Booking cancelled: ${reason}`
          : 'Booking cancelled successfully',
      };
    });
  }

  async expireBooking(bookingId: string): Promise<{ success: boolean; message: string }> {
    return await this.dataSource.transaction(async manager => {
      // 1. Find booking
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['seatStatuses'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // 2. Only expire PENDING bookings
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException(
          `Cannot expire booking with status: ${booking.status}`,
        );
      }

      // 3. Update booking status to EXPIRED
      await manager.update(Booking, bookingId, {
        status: BookingStatus.EXPIRED,
      });

      // 4. Release seats
      const seatStatuses = booking.seatStatuses || [];
      for (const seatStatus of seatStatuses) {
        await manager.update(SeatStatus, seatStatus.id, {
          bookingId: null,
          state: SeatState.AVAILABLE,
        });
      }

      return {
        success: true,
        message: 'Booking expired and seats released',
      };
    });
  }

  async getBookingsByStatus(status: BookingStatus): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { status },
      relations: ['user', 'trip', 'passengerDetails', 'seatStatuses'],
      order: { bookedAt: 'DESC' },
    });
  }

  async findExpiredBookings(): Promise<Booking[]> {
    // Find PENDING bookings older than 15 minutes
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    return await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.status = :status', { status: BookingStatus.PENDING })
      .andWhere('booking.bookedAt < :expiryTime', { expiryTime: fifteenMinutesAgo })
      .getMany();
  }

  async updatePassengerInfo(
    bookingId: string,
    updatePassengerDto: { passengers: Array<{ id: string; fullName: string; documentId: string; seatCode: string; }> },
    userId: string,
  ): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {
      // Find and verify booking ownership
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['passengerDetails'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.userId !== userId) {
        throw new BadRequestException('Access denied');
      }

      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException('Can only update passenger info for pending bookings');
      }

      // Update passenger details
      for (const passengerUpdate of updatePassengerDto.passengers) {
        const passengerDetail = await manager.findOne(PassengerDetail, {
          where: { id: passengerUpdate.id, bookingId: bookingId },
        });

        if (!passengerDetail) {
          throw new NotFoundException(`Passenger detail with ID ${passengerUpdate.id} not found`);
        }

        // Update passenger information
        await manager.update(PassengerDetail, passengerUpdate.id, {
          fullName: passengerUpdate.fullName,
          documentId: passengerUpdate.documentId,
          seatCode: passengerUpdate.seatCode,
        });
      }

      // Create audit log
      await this.createAuditLog(
        'UPDATE_PASSENGER_INFO',
        `Updated passenger information for booking ${bookingId}`,
        userId,
        undefined,
        {
          bookingId,
          updatedPassengers: updatePassengerDto.passengers.map(p => p.id),
        },
      );

      // Return updated booking
      const updatedBooking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['trip', 'passengerDetails', 'seatStatuses', 'seatStatuses.seat'],
      });

      if (!updatedBooking) {
        throw new NotFoundException('Updated booking not found');
      }

      // Transform to response format
      return {
        id: updatedBooking.id,
        userId: updatedBooking.userId,
        tripId: updatedBooking.tripId,
        totalAmount: updatedBooking.totalAmount,
        status: updatedBooking.status,
        bookedAt: updatedBooking.bookedAt,
        cancelledAt: updatedBooking.cancelledAt,
        passengers: updatedBooking.passengerDetails?.map(p => ({
          id: p.id,
          fullName: p.fullName,
          documentId: p.documentId,
          seatCode: p.seatCode,
        })) || [],
        seats: updatedBooking.seatStatuses?.map(s => ({
          id: s.id,
          seatCode: s.seat?.seatCode || '',
          state: s.state,
        })) || [],
        expirationTimestamp: updatedBooking.status === 'pending' ? 
          new Date(updatedBooking.bookedAt.getTime() + 15 * 60 * 1000) : null,
      };
    });
  }

  async cancelBookingByUser(bookingId: string, userId: string): Promise<{ success: boolean; message: string; }> {
    return await this.dataSource.transaction(async (manager) => {
      // Find and verify booking ownership
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['seatStatuses', 'trip'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      console.log(`Cancel booking debug:`, {
        bookingId,
        userId,
        booking: {
          id: booking.id,
          userId: booking.userId,
          status: booking.status,
          departureTime: booking.trip?.departureTime
        }
      });

      if (booking.userId !== userId) {
        throw new BadRequestException('Access denied');
      }

      if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.PAID) {
        throw new BadRequestException(`Can only cancel pending or paid bookings. Current status: ${booking.status}`);
      }

      // Check if booking can be cancelled (at least 6 hours before departure)
      if (booking.trip?.departureTime) {
        const departureTime = new Date(booking.trip.departureTime);
        const currentTime = new Date();
        const timeDifference = departureTime.getTime() - currentTime.getTime();
        const hoursUntilDeparture = timeDifference / (1000 * 60 * 60); // Convert to hours

        console.log(`Time check:`, {
          departureTime: departureTime.toISOString(),
          currentTime: currentTime.toISOString(),
          hoursUntilDeparture
        });

        if (hoursUntilDeparture < 6) {
          throw new BadRequestException(`Cannot cancel booking less than 6 hours before departure. Hours until departure: ${hoursUntilDeparture.toFixed(2)}`);
        }
      }

      // Update booking status to cancelled
      await manager.update(Booking, bookingId, {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      // Release seats
      for (const seatStatus of booking.seatStatuses) {
        await manager.update(SeatStatus, seatStatus.id, {
          state: SeatState.AVAILABLE,
        });
      }

      // Create audit log
      await this.createAuditLog(
        'USER_CANCEL_BOOKING',
        `Booking ${bookingId} cancelled by user`,
        userId,
        undefined,
        {
          bookingId,
          previousStatus: booking.status,
          newStatus: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      );

      return {
        success: true,
        message: 'Booking cancelled successfully',
      };
    });
  }

  private async createAuditLog(
    action: string,
    details?: string,
    actorId?: string,
    targetUserId?: string,
    metadata?: any,
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        details,
        actorId,
        targetUserId,
        metadata,
      });
      await this.auditLogRepository.save(auditLog);
      this.logger.log(`Audit logged: ${action}`);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  async processExpiredBookings(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      this.logger.log('Starting expired bookings cleanup...');
      
      const expiredBookings = await this.findExpiredBookings();
      
      if (expiredBookings.length === 0) {
        this.logger.log('No expired bookings found');
        return { processed: 0, errors: [] };
      }

      this.logger.log(`Found ${expiredBookings.length} expired bookings`);

      for (const booking of expiredBookings) {
        try {
          await this.expireBooking(booking.id);
          processed++;
          
          // Log audit trail
          await this.createAuditLog(
            'AUTO_EXPIRED_BOOKING',
            `Booking ${booking.id} automatically expired due to timeout`,
            undefined, // no actor for automated process
            undefined, // no target user
            {
              bookingId: booking.id,
              previousStatus: BookingStatus.PENDING,
              newStatus: BookingStatus.EXPIRED,
              expiredAt: new Date(),
            },
          );
          
          this.logger.log(`Auto-expired booking ${booking.id}`);
        } catch (error) {
          const errorMsg = `Failed to expire booking ${booking.id}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      this.logger.log(`Expired bookings cleanup completed. Processed: ${processed}, Errors: ${errors.length}`);
      
      return { processed, errors };
    } catch (error) {
      const errorMsg = `Error during expired bookings cleanup: ${error.message}`;
      this.logger.error(errorMsg);
      return { processed, errors: [errorMsg] };
    }
  }

  // This method now correctly loads the user relation to fix the email issue
  private async getBookingForEticket(bookingId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        user: true, // This ensures the user relation is loaded for email access
        trip: {
          route: true,
          bus: true,
        },
        passengerDetails: true,
      },
    });

    if (booking) {
      // If booking has a userId, treat as user booking; otherwise as guest.
      const type = booking.userId ? ('user' as const) : ('guest' as const);
      return { type, booking };
    }

    throw new NotFoundException({
      success: false,
      error: { code: 'BOOK_002', message: 'booking not found' },
      timestamp: new Date().toISOString(),
    });
  }

  async generateEticketFile(bookingId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { booking } = await this.getBookingForEticket(bookingId);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    return await new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const filename = `${booking.bookingReference || 'ticket'}.pdf`;
        resolve({ buffer, filename });
      });
      doc.on('error', (err) => reject(err));

      // Use PDFKit's built-in fonts that support Unicode
      doc.font('Helvetica');

      // Header
      doc
        .fontSize(20)
        .text('Bus Ticket E-Ticket', { align: 'center' })
        .moveDown();

      // Booking info
      doc
        .fontSize(12)
        .text(`Booking Reference: ${booking.bookingReference}`, { continued: false })
        .text(`Booking ID: ${booking.id}`)
        .moveDown();

      if (booking.trip) {
        const trip = booking.trip as any;
        const route = trip.route || {};
        const bus = trip.bus || {};

        doc
          .fontSize(14)
          .text('Trip Details', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .text(`Route: ${route.origin || ''} -> ${route.destination || ''}`)
          .text(`Departure: ${trip.departureTime}`)
          .text(`Arrival: ${trip.arrivalTime}`)
          .text(`Bus: ${bus.model || ''} (${bus.plateNumber || ''})`)
          .moveDown();
      }

      // Passengers
      doc.fontSize(14).text('Passengers', { underline: true }).moveDown(0.5);

      (booking.passengerDetails || []).forEach((p, index) => {
        doc
          .fontSize(12)
          .text(
            `${index + 1}. ${p.fullName} - Doc: ${p.documentId} - Seat: ${p.seatCode}`,
          );
      });

      doc.moveDown();

      // Pricing
      doc.fontSize(14).text('Pricing', { underline: true }).moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Total Amount: ${booking.totalAmount} VND`)
        .moveDown();

      // Footer
      doc
        .fontSize(10)
        .text(
          'Please arrive at the station at least 30 minutes before departure. This e-ticket must be presented when boarding.',
          { align: 'left' },
        );

      doc.end();
    });
  }

  async sendEticketEmail(bookingId: string, overrideEmail?: string): Promise<{ success: boolean }> {
    const { booking } = await this.getBookingForEticket(bookingId);

    const to =
      overrideEmail ||
      booking.user?.email ||
      booking.contactEmail;

    if (!to) {
      throw new BadRequestException('No email available for this booking');
    }

    const { buffer, filename } = await this.generateEticketFile(bookingId);

    await this.emailService.sendEmail({
      to,
      subject: `Your e-ticket ${booking.bookingReference}`,
      text: `Dear customer,\n\nPlease find attached your e-ticket for booking ${booking.bookingReference}.`,
      attachments: [
        {
          filename,
          content: buffer,
        },
      ],
    });

    return { success: true };
  }
}
