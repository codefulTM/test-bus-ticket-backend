import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { databaseConfig } from './config/database.config';
import { AdminModule } from './admin/admin.module';
import { TripsModule } from './trips/trips.module';
import { BusModule } from './bus/bus.module';
import { RouteController } from './route/route.controller';
import { RouteModule } from './route/route.module';
import { OperatorModule } from './operator/operator.module';
import { SeatLayoutModule } from './seat-layout/seat-layout.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { BookingModule } from './booking/booking.module';
import { UserModule } from './user/user.module';
import { PoolMonitorMiddleware } from './middleware/pool-monitor.middleware';
import { DatabaseService } from './database/database.service';
import { GatewaysModule } from './gateways/gateways.module';
import { SeatStatusModule } from './seat-status/seat-status.module';
import { SeatModule } from './seat/seat.module';
import { PayosModule } from './payos/payos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        databaseConfig(configService),
      inject: [ConfigService],
    }),
    AuthModule,
    AdminModule,
    TripsModule,
    BusModule,
    RouteModule,
    OperatorModule,
    SeatLayoutModule,
    DatabaseModule,
    BookingModule,
    UserModule,
    GatewaysModule,
    SeatStatusModule,
    SeatModule,
    PayosModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PoolMonitorMiddleware).forRoutes('*'); // Apply to all routes
  }
}
