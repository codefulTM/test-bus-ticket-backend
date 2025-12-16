/**
 * WebSocket Gateway for Real-Time Booking Management
 *
 * This gateway handles real-time booking status updates and notifications
 * to keep users informed about their booking progress and changes.
 *
 * Features:
 * - Real-time booking status updates
 * - Trip-based booking notifications
 * - Payment status tracking
 * - Booking cancellation notifications
 * - User-specific booking updates
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../entities/booking.entity';
import { In } from 'typeorm';

/**
 * Represents a booking tracking session
 */
interface BookingSession {
  /** ID of the booking */
  bookingId: string;
  /** ID of the user tracking the booking */
  userId: string;
  /** Socket connection ID of the user */
  socketId: string;
  /** ID of the trip the booking belongs to */
  tripId: string;
  /** When the session was created */
  createdAt: Date;
}

/**
 * Message structure for booking status updates
 */
interface BookingStatusUpdate {
  /** ID of the booking */
  bookingId: string;
  /** ID of the trip */
  tripId: string;
  /** Current status of the booking */
  status: BookingStatus;
  /** ID of the user who caused the status change */
  userId?: string;
  /** Additional metadata about the update */
  metadata?: Record<string, any>;
}

/**
 * Message structure for payment updates
 */
interface PaymentUpdate {
  /** ID of the booking */
  bookingId: string;
  /** ID of the trip */
  tripId: string;
  /** Payment status */
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  /** Payment amount */
  amount: number;
  /** Payment method */
  paymentMethod?: string;
  /** Transaction ID */
  transactionId?: string;
}

/**
 * WebSocket Gateway Configuration
 * - Allows connections from frontend URL
 * - Uses '/bookings' namespace for booking-related events
 * - Enables CORS for cross-origin requests
 */
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/bookings',
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  /** WebSocket server instance for broadcasting messages */
  @WebSocketServer()
  server: Server;

  /** Logger for debugging and monitoring */
  private readonly logger = new Logger(BookingGateway.name);
  /** Storage for active booking tracking sessions (key: "userId:bookingId", value: BookingSession) */
  private bookingSessions: Map<string, BookingSession> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {
    // Configure CORS dynamically based on environment
    this.updateCorsConfiguration();
  }

  /**
   * Updates CORS configuration based on environment variables
   * This method is called in constructor after ConfigService is available
   */
  private updateCorsConfiguration() {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const allowedOrigins = [
      frontendUrl || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8000',
    ].filter(Boolean); // Remove null/undefined values

    this.logger.log(
      `Frontend URL configured: ${frontendUrl || 'http://localhost:3000'}`,
    );
    this.logger.log(`Allowed origins: ${allowedOrigins.join(', ')}`);

    // Update the server's CORS configuration dynamically
    if (this.server && this.server.httpServer) {
      const io = this.server as any;
      if (io.engine && io.engine.opts) {
        io.engine.opts.cors = {
          origin: allowedOrigins,
          credentials: true,
        };
      }
    }
  }

  /**
   * Called when a new client connects to the WebSocket
   * @param client - The connected socket client
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Re-apply CORS configuration when first client connects
    // This ensures the configuration is active
    this.updateCorsConfiguration();
  }

  /**
   * Called when a client disconnects from the WebSocket
   * Automatically removes all booking tracking sessions for the disconnected client
   * @param client - The disconnected socket client
   */
  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove all booking sessions for this client
    await this.removeClientSessions(client.id);
  }

  /**
   * Handles client joining a trip room to receive booking updates
   * Client receives current active bookings for the trip immediately upon joining
   */
  @SubscribeMessage('joinTrip')
  async handleJoinTrip(
    @MessageBody() data: { tripId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tripId, userId } = data;
    // Add client to trip-specific room for targeted broadcasts
    client.join(`trip:${tripId}`);
    this.logger.log(`Client ${client.id} joined trip ${tripId}`);

    // Send current active bookings for this trip to the new client
    const activeBookings = await this.getActiveBookingsForTrip(tripId);
    client.emit('currentBookings', { tripId, bookings: activeBookings });

    return { success: true, tripId };
  }

  /**
   * Handles client leaving a trip room
   * Removes all booking tracking sessions for that specific trip
   */
  @SubscribeMessage('leaveTrip')
  async handleLeaveTrip(
    @MessageBody() data: { tripId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tripId } = data;
    // Remove client from trip room
    client.leave(`trip:${tripId}`);
    this.logger.log(`Client ${client.id} left trip ${tripId}`);

    // Remove booking sessions for this trip by this client
    await this.removeClientSessionsForTrip(client.id, tripId);

    return { success: true, tripId };
  }

  /**
   * Handles client tracking a specific booking
   * Allows users to receive real-time updates for their bookings
   */
  @SubscribeMessage('trackBooking')
  async handleTrackBooking(
    @MessageBody() data: { bookingId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { bookingId, userId } = data;

    try {
      // Verify booking exists
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['trip'],
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      // Create or update tracking session
      const sessionKey = `${userId || client.id}:${bookingId}`;
      const session: BookingSession = {
        bookingId,
        userId: userId || client.id,
        socketId: client.id,
        tripId: booking.tripId,
        createdAt: new Date(),
      };

      this.bookingSessions.set(sessionKey, session);
      client.join(`booking:${bookingId}`);

      // Send current booking status
      client.emit('bookingStatus', {
        bookingId,
        tripId: booking.tripId,
        status: booking.status,
        totalAmount: booking.totalAmount,
        bookedAt: booking.bookedAt,
      });

      this.logger.log(
        `Client ${client.id} started tracking booking ${bookingId}`,
      );

      return { success: true, bookingId, status: booking.status };
    } catch (error) {
      this.logger.error(
        `Failed to track booking ${bookingId}: ${error.message}`,
      );
      return { success: false, message: 'Failed to track booking' };
    }
  }

  /**
   * Handles client stopping tracking of a specific booking
   */
  @SubscribeMessage('untrackBooking')
  async handleUntrackBooking(
    @MessageBody() data: { bookingId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { bookingId, userId } = data;
    const sessionKey = `${userId || client.id}:${bookingId}`;

    const session = this.bookingSessions.get(sessionKey);
    if (session && session.socketId === client.id) {
      this.bookingSessions.delete(sessionKey);
      client.leave(`booking:${bookingId}`);

      this.logger.log(
        `Client ${client.id} stopped tracking booking ${bookingId}`,
      );
      return { success: true, bookingId };
    }

    return { success: false, message: 'Tracking session not found' };
  }

  /**
   * Handles booking status update requests
   * Broadcasts status changes to all relevant clients
   */
  @SubscribeMessage('updateBookingStatus')
  async handleUpdateBookingStatus(
    @MessageBody()
    data: {
      bookingId: string;
      status: BookingStatus;
      userId?: string;
      metadata?: Record<string, any>;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { bookingId, status, userId, metadata } = data;

    try {
      // Verify booking exists and update status
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['trip'],
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      // Update booking status in database
      await this.bookingRepository.update(bookingId, {
        status,
        ...(status === BookingStatus.CANCELLED && { cancelledAt: new Date() }),
      });

      // Notify all clients tracking this booking
      this.server.to(`booking:${bookingId}`).emit('bookingStatusUpdated', {
        bookingId,
        tripId: booking.tripId,
        status,
        userId: userId || client.id,
        metadata,
        updatedAt: new Date(),
      });

      // Notify all clients in the trip room
      this.server.to(`trip:${booking.tripId}`).emit('bookingStatusUpdated', {
        bookingId,
        tripId: booking.tripId,
        status,
        userId: userId || client.id,
        metadata,
        updatedAt: new Date(),
      });

      this.logger.log(
        `Booking ${bookingId} status updated to ${status} by ${userId || client.id}`,
      );

      return { success: true, bookingId, status };
    } catch (error) {
      this.logger.error(
        `Failed to update booking status for ${bookingId}: ${error.message}`,
      );
      return { success: false, message: 'Failed to update booking status' };
    }
  }

  /**
   * Handles payment status update requests
   * Broadcasts payment updates to all relevant clients
   */
  @SubscribeMessage('updatePaymentStatus')
  async handleUpdatePaymentStatus(
    @MessageBody()
    data: {
      bookingId: string;
      paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
      amount?: number;
      paymentMethod?: string;
      transactionId?: string;
      userId?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const {
      bookingId,
      paymentStatus,
      amount,
      paymentMethod,
      transactionId,
      userId,
    } = data;

    try {
      // Verify booking exists
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['trip'],
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      // Update booking status based on payment status
      let newBookingStatus: BookingStatus;
      switch (paymentStatus) {
        case 'completed':
          newBookingStatus = BookingStatus.PAID;
          break;
        case 'failed':
          newBookingStatus = BookingStatus.PENDING;
          break;
        case 'refunded':
          newBookingStatus = BookingStatus.CANCELLED;
          break;
        default:
          newBookingStatus = booking.status;
      }

      // Update booking status if changed
      if (newBookingStatus !== booking.status) {
        await this.bookingRepository.update(bookingId, {
          status: newBookingStatus,
          ...(newBookingStatus === BookingStatus.CANCELLED && {
            cancelledAt: new Date(),
          }),
        });
      }

      // Prepare payment update data
      const paymentUpdate: PaymentUpdate = {
        bookingId,
        tripId: booking.tripId,
        paymentStatus,
        amount: amount || booking.totalAmount,
        paymentMethod,
        transactionId,
      };

      // Notify all clients tracking this booking
      this.server
        .to(`booking:${bookingId}`)
        .emit('paymentStatusUpdated', paymentUpdate);

      // Notify all clients in the trip room
      this.server
        .to(`trip:${booking.tripId}`)
        .emit('paymentStatusUpdated', paymentUpdate);

      this.logger.log(
        `Payment status for booking ${bookingId} updated to ${paymentStatus}`,
      );

      return {
        success: true,
        bookingId,
        paymentStatus,
        bookingStatus: newBookingStatus,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update payment status for booking ${bookingId}: ${error.message}`,
      );
      return { success: false, message: 'Failed to update payment status' };
    }
  }

  /**
   * Called when a new booking is created
   * Notifies all relevant clients about the new booking
   * @param booking - The newly created booking
   */
  public notifyBookingCreated(booking: Booking) {
    // Notify all clients in the trip room
    this.server.to(`trip:${booking.tripId}`).emit('bookingCreated', {
      bookingId: booking.id,
      tripId: booking.tripId,
      userId: booking.userId,
      status: booking.status,
      totalAmount: booking.totalAmount,
      bookingReference: booking.bookingReference,
      bookedAt: booking.bookedAt,
    });

    this.logger.log(
      `New booking created: ${booking.id} for trip ${booking.tripId}`,
    );
  }

  /**
   * Called when a booking status changes
   * Notifies all tracking clients and trip room members
   * @param bookingId - The booking ID
   * @param newStatus - The new booking status
   * @param metadata - Additional metadata about the change
   */
  public notifyBookingStatusChanged(
    bookingId: string,
    newStatus: BookingStatus,
    metadata?: Record<string, any>,
  ) {
    this.server.to(`booking:${bookingId}`).emit('bookingStatusUpdated', {
      bookingId,
      status: newStatus,
      metadata,
      updatedAt: new Date(),
    });

    this.logger.log(`Booking ${bookingId} status changed to ${newStatus}`);
  }

  /**
   * Called when a payment is processed
   * Notifies all relevant clients about payment status
   * @param bookingId - The booking ID
   * @param tripId - The trip ID
   * @param paymentData - Payment information
   */
  public notifyPaymentProcessed(
    bookingId: string,
    tripId: string,
    paymentData: Partial<PaymentUpdate>,
  ) {
    const paymentUpdate: PaymentUpdate = {
      bookingId,
      tripId,
      ...paymentData,
    } as PaymentUpdate;

    // Notify clients tracking the booking
    this.server
      .to(`booking:${bookingId}`)
      .emit('paymentStatusUpdated', paymentUpdate);

    // Notify clients in the trip room
    this.server
      .to(`trip:${tripId}`)
      .emit('paymentStatusUpdated', paymentUpdate);

    this.logger.log(`Payment processed for booking ${bookingId}`);
  }

  /**
   * Called when a booking is cancelled
   * Notifies all relevant clients about the cancellation
   * @param bookingId - The booking ID
   * @param tripId - The trip ID
   * @param reason - Cancellation reason
   */
  public notifyBookingCancelled(
    bookingId: string,
    tripId: string,
    reason?: string,
  ) {
    const cancellationData = {
      bookingId,
      tripId,
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      reason,
    };

    // Notify clients tracking the booking
    this.server
      .to(`booking:${bookingId}`)
      .emit('bookingCancelled', cancellationData);

    // Notify clients in the trip room
    this.server.to(`trip:${tripId}`).emit('bookingCancelled', cancellationData);

    this.logger.log(`Booking ${bookingId} cancelled`);
  }

  /**
   * Gets all active bookings for a specific trip
   * @param tripId - The trip ID
   * @returns Array of active booking information
   */
  private async getActiveBookingsForTrip(tripId: string) {
    try {
      const activeBookings = await this.bookingRepository.find({
        where: {
          tripId,
          status: In([BookingStatus.PENDING, BookingStatus.PAID]),
        },
        relations: ['user'],
        select: [
          'id',
          'bookingReference',
          'userId',
          'totalAmount',
          'status',
          'bookedAt',
        ],
      });

      return activeBookings.map((booking) => ({
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        userId: booking.userId,
        totalAmount: booking.totalAmount,
        status: booking.status,
        bookedAt: booking.bookedAt,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get active bookings for trip ${tripId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Removes all booking tracking sessions for a specific client (when they disconnect)
   * @param socketId - The socket ID of the disconnected client
   */
  private async removeClientSessions(socketId: string) {
    const sessionsToRemove: string[] = [];

    this.bookingSessions.forEach((session, key) => {
      if (session.socketId === socketId) {
        sessionsToRemove.push(key);
      }
    });

    sessionsToRemove.forEach((key) => {
      const session = this.bookingSessions.get(key);
      if (session) {
        // Remove client from booking room (only if server and socket still exist)
        if (this.server?.sockets?.sockets) {
          const socket = this.server.sockets.sockets.get(socketId);
          if (socket) {
            socket.leave(`booking:${session.bookingId}`);
          }
        }
      }
      this.bookingSessions.delete(key);
    });

    if (sessionsToRemove.length > 0) {
      this.logger.log(
        `Removed ${sessionsToRemove.length} booking sessions for disconnected client ${socketId}`,
      );
    }
  }

  /**
   * Removes booking tracking sessions for a specific client and trip only
   * @param socketId - The socket ID of the client
   * @param tripId - The trip ID
   */
  private async removeClientSessionsForTrip(socketId: string, tripId: string) {
    const sessionsToRemove: string[] = [];

    this.bookingSessions.forEach((session, key) => {
      if (session.socketId === socketId && session.tripId === tripId) {
        sessionsToRemove.push(key);
        // Remove client from booking room
        this.server.sockets.sockets
          .get(socketId)
          ?.leave(`booking:${session.bookingId}`);
      }
    });

    sessionsToRemove.forEach((key) => this.bookingSessions.delete(key));

    if (sessionsToRemove.length > 0) {
      this.logger.log(
        `Removed ${sessionsToRemove.length} booking sessions for client ${socketId} in trip ${tripId}`,
      );
    }
  }
}
