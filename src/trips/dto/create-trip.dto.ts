import { IsString, IsEnum, IsNumber, IsUUID } from 'class-validator';
import { TripStatus } from '../../entities/trip.entity';

export class CreateTripDto {
  @IsUUID()
  routeId: string;

  @IsUUID()
  busId: string;

  @IsString()
  departureTime: string;

  @IsString()
  arrivalTime: string;

  @IsNumber()
  basePrice: number;

  @IsEnum(TripStatus)
  status?: TripStatus;
}
