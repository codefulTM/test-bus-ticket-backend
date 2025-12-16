import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../entities/route.entity';
import { RoutePoint } from '../entities/route-point.entity';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';
import { RoutePointController } from './route-point.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Route, RoutePoint])
  ],
  controllers: [RouteController, RoutePointController],
  providers: [RouteService],
  exports: [RouteService],
})
export class RouteModule {}
