import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PayOS,
  CreatePaymentLinkResponse,
  PaymentLinkStatus,
  PaymentLink,
  Webhook,
  WebhookData,
} from '@payos/node';
import { Repository } from 'typeorm';
import { CreatePaymentDto } from './dto/create-payment.dto';

import {
  PaymentResponseDto,
  WebhookResponseDto,
} from './dto/payment-response.dto';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { SeatStatus, SeatState } from '../entities/seat-status.entity';
import { SeatStatusGateway } from '../gateways/seat-status.gateway';
import { BookingGateway } from '../gateways/booking.gateway';

@Injectable()
export class PayosService {
  private readonly logger = new Logger(PayosService.name);
  private readonly payos: PayOS;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(SeatStatus)
    private seatStatusRepository: Repository<SeatStatus>,
    private seatStatusGateway: SeatStatusGateway,
    private bookingGateway: BookingGateway,
  ) {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY');
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY');

    if (!clientId || !apiKey || !checksumKey) {
      throw new Error(
        'PayOS configuration is missing. Please check environment variables.',
      );
    }

    this.payos = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
  }

  async createPaymentLink(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    try {
      const orderCode = this.generateOrderCode();
      // console.log(orderCode);
      // 2147483647
      const paymentData = {
        orderCode,
        amount: createPaymentDto.amount,
        description: createPaymentDto.description,
        returnUrl:
          createPaymentDto.returnUrl ||
          this.configService.get<string>('PAYOS_RETURN_URL') ||
          'http://localhost:8000/payment/success',
        cancelUrl:
          createPaymentDto.cancelUrl ||
          this.configService.get<string>('PAYOS_CANCEL_URL') ||
          'http://localhost:8000/payment/cancel',
        items:
          createPaymentDto.items?.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
            taxPercentage: item.taxPercentage as any,
          })) || [],
      };

      const paymentLink = (await this.payos.paymentRequests.create(
        paymentData,
      )) as CreatePaymentLinkResponse;

      this.logger.log(
        `Payment link created successfully for order ${orderCode}`,
      );

      // Create payment record in database
      const payment = this.paymentRepository.create({
        bookingId: createPaymentDto.bookingId,
        provider: 'PAYOS',
        transactionRef: (paymentLink.paymentLinkId as string) || '',
        payosOrderCode: orderCode,
        amount: createPaymentDto.amount,
        status: PaymentStatus.PENDING,
      });
      await this.paymentRepository.save(payment);

      return {
        checkoutUrl: paymentLink.checkoutUrl || '',
        orderCode: paymentLink.orderCode,
        accountNumber: paymentLink.accountNumber || '',
        accountName: paymentLink.accountName || '',
        amount: paymentLink.amount,
        description: paymentLink.description || '',
        transactionId: paymentLink.paymentLinkId || '',
        status: paymentLink.status || 'PENDING',
        paymentId: payment.id,
      };
    } catch (error) {
      this.logger.error('Failed to create payment link', error);
      throw error;
    }
  }

  async getPaymentInformation(orderCode: number): Promise<PaymentResponseDto> {
    try {
      const paymentInfo = (await this.payos.paymentRequests.get(
        orderCode,
      )) as PaymentLink;

      // Get account info from most recent transaction if available
      const latestTransaction =
        paymentInfo.transactions?.[paymentInfo.transactions.length - 1];

      return {
        checkoutUrl: '', // PaymentLink doesn't have checkoutUrl, need to reconstruct or store separately
        orderCode: paymentInfo.orderCode,
        accountNumber: latestTransaction?.accountNumber || '',
        accountName: latestTransaction?.virtualAccountName || '',
        amount: paymentInfo.amount,
        description: latestTransaction?.description || '',
        transactionId: paymentInfo.id,
        status: paymentInfo.status,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get payment information for order ${orderCode}`,
        error,
      );
      throw error;
    }
  }

  async cancelPayment(orderCode: number): Promise<PaymentResponseDto> {
    try {
      const cancelledPayment =
        await this.payos.paymentRequests.cancel(orderCode);

      this.logger.log(`Payment cancelled successfully for order ${orderCode}`);

      // Get payment record to find booking ID
      const payment = await this.paymentRepository.findOne({
        where: { payosOrderCode: orderCode },
      });

      if (payment) {
        // Update payment status in database
        await this.paymentRepository.update(
          { payosOrderCode: orderCode },
          { status: PaymentStatus.CANCELLED },
        );

        this.logger.log(
          `Payment status updated to CANCELLED in database for order ${orderCode}`,
        );

        // Update booking status to CANCELLED
        if (payment.bookingId) {
          await this.bookingRepository.update(
            { id: payment.bookingId },
            {
              status: BookingStatus.CANCELLED,
              cancelledAt: new Date(),
            },
          );

          this.logger.log(
            `Booking status updated to CANCELLED for booking ${payment.bookingId}`,
          );

          // Get seat information before updating for real-time notification
          const seatStatuses = await this.seatStatusRepository.find({
            where: { bookingId: payment.bookingId },
            relations: ['trip'],
          });

          // Release seats back to AVAILABLE status
          await this.seatStatusRepository.update(
            { bookingId: payment.bookingId },
            {
              state: SeatState.AVAILABLE,
              bookingId: null,
              lockedUntil: null,
            },
          );

          this.logger.log(
            `Seats released back to AVAILABLE for booking ${payment.bookingId}`,
          );

          // Notify clients in real-time about seat availability
          if (seatStatuses.length > 0) {
            const tripId = seatStatuses[0].tripId;
            const seatIds = seatStatuses.map((seat) => seat.seatId);

            this.seatStatusGateway.notifySeatsAvailable(tripId, seatIds);

            this.logger.log(
              `Real-time notification sent for ${seatIds.length} seats now available for trip ${tripId}`,
            );
          }
        }
      }

      // The cancel response has different structure, so we need to construct the response
      // with available data and defaults for missing properties
      return {
        checkoutUrl: '', // Cancel operation doesn't return a checkout URL
        orderCode: cancelledPayment.orderCode || orderCode,
        accountNumber: '', // Cancel operation doesn't return account info
        accountName: '', // Cancel operation doesn't return account info
        amount: cancelledPayment.amount || 0,
        description: 'Payment cancelled', // Use default description since cancel response doesn't include it
        transactionId: cancelledPayment.id?.toString() || '',
        status: cancelledPayment.status || 'CANCELLED',
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel payment for order ${orderCode}`,
        error,
      );
      throw error;
    }
  }

  async verifyWebhookData(webhookData: any): Promise<WebhookData> {
    try {
      // Verify webhook signature using PayOS method
      const verifiedData = await this.payos.webhooks.verify(webhookData);
      this.logger.log('Verified data:', verifiedData);
      this.logger.log('Webhook data verified successfully');
      return verifiedData;
    } catch (error) {
      this.logger.error('Error verifying webhook data', error);
      throw error;
    }
  }

  async handleWebhook(webhookData: WebhookData): Promise<WebhookResponseDto> {
    try {
      const { orderCode, amount, description, code, desc } = webhookData;

      // Determine success based on code (00 = success for PayOS)
      const success = code === '00';

      this.logger.log(
        `Webhook received for order ${orderCode} with status ${success}`,
      );
      this.logger.log(
        `Webhook details - OrderCode: ${orderCode}, Amount: ${amount}, Code: ${code}, Description: ${desc || description}`,
      );

      // Get payment record to find booking ID
      let payment;
      try {
        payment = await this.paymentRepository.findOne({
          where: { payosOrderCode: orderCode },
        });
        this.logger.log(`Payment record lookup for order ${orderCode}: ${payment ? 'FOUND' : 'NOT_FOUND'}`);
      } catch (dbError) {
        this.logger.error(`Database error when fetching payment record for order ${orderCode}:`, dbError);
        return {
          success: false,
          message: 'Database error when fetching payment record',
        };
      }

      if (!payment) {
        this.logger.warn(`No payment record found for order ${orderCode}. This might indicate an invalid order code or payment record deletion.`);
        return {
          success: false,
          message: 'Payment record not found',
        };
      }

      this.logger.log(`Payment record found - ID: ${payment.id}, BookingID: ${payment.bookingId}, Current Status: ${payment.status}`);

      // Update payment status in database based on webhook success status
      const paymentStatus = success
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;

      try {
        const updateResult = await this.paymentRepository.update(
          { payosOrderCode: orderCode },
          { status: paymentStatus },
        );
        this.logger.log(
          `Payment status updated to ${paymentStatus} in database for order ${orderCode}. Affected rows: ${updateResult.affected || 0}`,
        );
      } catch (updateError) {
        this.logger.error(`Failed to update payment status for order ${orderCode}:`, updateError);
        return {
          success: false,
          message: 'Failed to update payment status',
        };
      }

      // Handle booking and seat status updates based on payment status
      if (payment.bookingId) {
        this.logger.log(`Processing booking ${payment.bookingId} for payment ${success ? 'SUCCESS' : 'FAILURE'}`);
        
        // Get seat information before updating for real-time notification
        let seatStatuses;
        try {
          seatStatuses = await this.seatStatusRepository.find({
            where: { bookingId: payment.bookingId },
            relations: ['trip'],
          });
          this.logger.log(`Found ${seatStatuses.length} seat status records for booking ${payment.bookingId}`);
        } catch (seatError) {
          this.logger.error(`Failed to fetch seat statuses for booking ${payment.bookingId}:`, seatError);
        }

        // Get booking information for booking gateway notifications
        let booking;
        try {
          booking = await this.bookingRepository.findOne({
            where: { id: payment.bookingId },
            relations: ['trip'],
          });
          this.logger.log(`Booking lookup for ${payment.bookingId}: ${booking ? 'FOUND' : 'NOT_FOUND'}`);
        } catch (bookingError) {
          this.logger.error(`Failed to fetch booking ${payment.bookingId}:`, bookingError);
        }

        if (success) {
          // Payment successful - update booking to PAID and confirm seat bookings
          try {
            const bookingUpdateResult = await this.bookingRepository.update(
              { id: payment.bookingId },
              { status: BookingStatus.PAID },
            );
            this.logger.log(
              `Booking status updated to PAID for booking ${payment.bookingId}. Affected rows: ${bookingUpdateResult.affected || 0}`,
            );
          } catch (bookingUpdateError) {
            this.logger.error(`Failed to update booking status to PAID for booking ${payment.bookingId}:`, bookingUpdateError);
          }

          // Update seat statuses from LOCKED/RESERVED to BOOKED
          try {
            const seatUpdateResult = await this.seatStatusRepository.update(
              { bookingId: payment.bookingId },
              {
                state: SeatState.BOOKED,
                lockedUntil: null, // Clear any lock timers
              },
            );
            this.logger.log(
              `Seat statuses updated to BOOKED for booking ${payment.bookingId}. Affected rows: ${seatUpdateResult.affected || 0}`,
            );
          } catch (seatUpdateError) {
            this.logger.error(`Failed to update seat statuses to BOOKED for booking ${payment.bookingId}:`, seatUpdateError);
          }

          // Notify clients using BookingGateway for booking status change
          if (booking) {
            try {
              this.bookingGateway.notifyBookingStatusChanged(
                payment.bookingId,
                BookingStatus.PAID,
                {
                  paymentCompleted: true,
                  paymentMethod: 'payos',
                  transactionId: orderCode.toString(),
                },
              );
              this.logger.log(`Booking gateway notification sent for booking ${payment.bookingId} - PAID status`);
            } catch (gatewayError) {
              this.logger.error(`Failed to send booking gateway notification for booking ${payment.bookingId}:`, gatewayError);
            }
          } else {
            this.logger.warn(`Skipping booking gateway notification - booking not found for ${payment.bookingId}`);
          }

          // Notify clients in real-time about seat booking confirmation
          if (seatStatuses && seatStatuses.length > 0) {
            try {
              const tripId = seatStatuses[0].tripId;
              const seatIds = seatStatuses.map((seat) => seat.seatId);

              this.seatStatusGateway.notifySeatBooked(tripId, seatIds);

              this.logger.log(
                `Real-time notification sent for ${seatIds.length} seats now booked for trip ${tripId}`,
              );
            } catch (seatNotificationError) {
              this.logger.error(`Failed to send seat booking notification for booking ${payment.bookingId}:`, seatNotificationError);
            }
          } else {
            this.logger.warn(`Skipping seat booking notification - no seat statuses found for booking ${payment.bookingId}`);
          }
        } else {
          // Payment failed - release seats back to AVAILABLE
          try {
            const bookingCancelResult = await this.bookingRepository.update(
              { id: payment.bookingId },
              {
                status: BookingStatus.CANCELLED,
                cancelledAt: new Date(),
              },
            );
            this.logger.log(
              `Booking status updated to CANCELLED for booking ${payment.bookingId} due to payment failure. Affected rows: ${bookingCancelResult.affected || 0}`,
            );
          } catch (bookingCancelError) {
            this.logger.error(`Failed to cancel booking ${payment.bookingId}:`, bookingCancelError);
          }

          // Release seats back to AVAILABLE status
          try {
            const seatReleaseResult = await this.seatStatusRepository.update(
              { bookingId: payment.bookingId },
              {
                state: SeatState.AVAILABLE,
                bookingId: null,
                lockedUntil: null,
              },
            );
            this.logger.log(
              `Seats released back to AVAILABLE for booking ${payment.bookingId} due to payment failure. Affected rows: ${seatReleaseResult.affected || 0}`,
            );
          } catch (seatReleaseError) {
            this.logger.error(`Failed to release seats for booking ${payment.bookingId}:`, seatReleaseError);
          }

          // Notify clients using BookingGateway for booking status change
          if (booking) {
            try {
              this.bookingGateway.notifyBookingStatusChanged(
                payment.bookingId,
                BookingStatus.CANCELLED,
                {
                  paymentFailed: true,
                  paymentMethod: 'payos',
                  transactionId: orderCode.toString(),
                  reason: 'Payment failed',
                },
              );
              this.logger.log(`Booking gateway notification sent for booking ${payment.bookingId} - CANCELLED status`);
            } catch (gatewayError) {
              this.logger.error(`Failed to send booking gateway notification for booking ${payment.bookingId}:`, gatewayError);
            }
          } else {
            this.logger.warn(`Skipping booking gateway notification - booking not found for ${payment.bookingId}`);
          }

          // Notify clients in real-time about seat availability
          if (seatStatuses && seatStatuses.length > 0) {
            try {
              const tripId = seatStatuses[0].tripId;
              const seatIds = seatStatuses.map((seat) => seat.seatId);

              this.seatStatusGateway.notifySeatsAvailable(tripId, seatIds);

              this.logger.log(
                `Real-time notification sent for ${seatIds.length} seats now available for trip ${tripId}`,
              );
            } catch (seatNotificationError) {
              this.logger.error(`Failed to send seat availability notification for booking ${payment.bookingId}:`, seatNotificationError);
            }
          } else {
            this.logger.warn(`Skipping seat availability notification - no seat statuses found for booking ${payment.bookingId}`);
          }
        }
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error('Critical error processing webhook:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        webhookData: {
          orderCode: webhookData.orderCode,
          amount: webhookData.amount,
          code: webhookData.code,
          desc: webhookData.desc,
        },
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        message: 'Failed to process webhook',
      };
    }
  }

  private generateOrderCode(): number {
    // Generate a timestamp-based code that fits within PostgreSQL integer range (max: 2,147,483,647)
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);

    // Take last 5 digits of timestamp + 3 digits random to stay within integer range
    const timestampPart = timestamp % 100000; // Last 5 digits
    const orderCode = parseInt(
      `${timestampPart}${random.toString().padStart(3, '0')}`,
    );
    // console.log(orderCode);
    // Ensure it's within integer range
    return Math.min(orderCode, 2147483647);
  }
}
