import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Operator } from '../entities/operator.entity';
import { Bus } from '../entities/bus.entity';
import { Route } from '../entities/route.entity';
import { RoutePoint } from '../entities/route-point.entity';
import { Trip } from '../entities/trip.entity';
import { Seat } from '../entities/seat.entity';
import { Booking } from '../entities/booking.entity';
import { PassengerDetail } from '../entities/passenger-detail.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { Feedback } from '../entities/feedback.entity';
import { SeatStatus } from '../entities/seat-status.entity';
import { Payment } from '../entities/payment.entity';
import { Notification } from '../entities/notification.entity';
import { AuditLog } from 'src/entities/audit-log.entity';
import { SeatLayout } from '../entities/seat-layout.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

/**
 * Database configuration for the application
 * Configures the connection to PostgreSQL and connection pooling settings
 * @param configService - The ConfigService instance to access environment variables
 * @returns TypeOrmModuleOptions with database configuration
 */
export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  // Database type (PostgreSQL in this case)
  type: 'postgres',
  
  // Connection details with fallback to default values
  host: configService.get<string>('DB_HOST', 'localhost'),  // Database server host
  port: configService.get<number>('DB_PORT', 5432),          // Database server port
  username: configService.get<string>('DB_USERNAME', 'postgres'),  // Database username
  password: configService.get<string>('DB_PASSWORD', 'postgres'),  // Database password
  database: configService.get<string>('DB_NAME', 'bus_booking'),   // Database name
  
  // List of all entity classes that will be used in the application
  entities: [
    User,              // User accounts and authentication
    Operator,          // Bus operators/companies
    Bus,               // Bus information
    SeatLayout,        // Bus seat layouts
    Route,             // Travel routes
    RoutePoint,        // Stops along routes
    Trip,              // Scheduled trips
    Seat,              // Seat information
    Booking,           // Booking records
    PassengerDetail,   // Passenger information
    PaymentMethod,     // Available payment methods
    Feedback,          // User feedback
    SeatStatus,        // Status of seats (available, booked, etc.)
    Payment,           // Payment records
    Notification,      // System notifications
    AuditLog,          // Audit trail
    RefreshToken,      // Refresh tokens for authentication
  ],
  
  // Automatically synchronize database schema with entities (disabled in production)
  synchronize: configService.get<string>('NODE_ENV', 'development') !== 'production',
  
  // Disable query logging for better performance
  logging: false,
  
  // Path to database migration files
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  
  // Extra connection options including connection pool configuration
  extra: {
    // =============================================
    // Database Connection Pool Configuration
    // =============================================
    
    // Maximum number of clients the pool should contain
    max: configService.get<number>('DB_POOL_MAX', 20),
    
    // Minimum number of clients to keep in the pool
    min: configService.get<number>('DB_POOL_MIN', 5),
    
    // Number of milliseconds a client must sit idle in the pool and not be checked out
    // before it is disconnected from the backend and discarded
    idleTimeoutMillis: configService.get<number>('DB_IDLE_TIMEOUT', 30000),
    
    // Number of milliseconds to wait before timing out when connecting a new client
    connectionTimeoutMillis: configService.get<number>('DB_CONNECTION_TIMEOUT', 5000),
    
    // How often to run the reaper to check for idle connections (in milliseconds)
    reapIntervalMillis: configService.get<number>('DB_REAP_INTERVAL', 1000),
    
    // Maximum number of times a client can be used before it is removed from the pool
    maxUses: configService.get<number>('DB_MAX_USES', 7500),
    
    // =============================================
    // Connection Validation
    // =============================================
    
    // Validate the connection before using it
    validateConnection: true,
    
    // SQL query to run to validate a connection
    validationQuery: 'SELECT 1',
    
    // =============================================
    // SSL Configuration
    // =============================================
    ssl: configService.get<string>('NODE_ENV') === 'production' ? {
      // Production: Require SSL with strict validation
      sslmode: "require",
      channel_binding: "require",
      rejectUnauthorized: false,  // In production, should be true with proper CA
    } : configService.get<string>('NODE_ENV') === 'staging' ? {
      // Staging: Require SSL with less strict validation
      sslmode: "require",
      rejectUnauthorized: false,
    } : false, 
  },
});
