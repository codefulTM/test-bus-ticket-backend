import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingService } from './booking.service';

@Injectable()
export class BookingSchedulerService {
  private readonly logger = new Logger(BookingSchedulerService.name);

  constructor(private readonly bookingService: BookingService) {}

  // Chạy mỗi 5 phút để check expired bookings
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredBookingsCleanup() {
    this.logger.log('Running scheduled booking expiration cleanup...');

    try {
      const result = await this.bookingService.processExpiredBookings();
      
      if (result.processed > 0) {
        this.logger.log(`Successfully processed ${result.processed} expired bookings`);
      }
      
      if (result.errors.length > 0) {
        this.logger.warn(`Encountered ${result.errors.length} errors during cleanup`);
        result.errors.forEach(error => this.logger.error(error));
      }
    } catch (error) {
      this.logger.error(`Critical error in scheduled booking cleanup: ${error.message}`, error.stack);
    }
  }

  // Manual trigger cho admin - chạy mỗi 30 phút
  @Cron('0 */30 * * * *')
  async handlePeriodicCleanup() {
    this.logger.log('Running periodic booking cleanup...');
    
    try {
      // Cleanup các booking đã expired > 24h để giảm database load
      await this.cleanupOldExpiredBookings();
    } catch (error) {
      this.logger.error(`Error in periodic cleanup: ${error.message}`, error.stack);
    }
  }

  private async cleanupOldExpiredBookings(): Promise<void> {
    // Có thể implement logic để archive hoặc delete các booking cũ
    // Ví dụ: move expired bookings > 30 days sang archive table
    this.logger.log('Periodic cleanup completed');
  }

  // Manual trigger method cho testing hoặc admin
  async triggerManualCleanup(): Promise<{ processed: number; errors: string[] }> {
    this.logger.log('Manual booking expiration cleanup triggered');
    return await this.bookingService.processExpiredBookings();
  }
}