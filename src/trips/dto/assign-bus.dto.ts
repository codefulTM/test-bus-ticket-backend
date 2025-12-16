import { IsDateString, IsUUID } from 'class-validator';

export class AssignBusDto {
  @IsUUID()
  routeId: string;

  @IsUUID()
  busId: string;

  @IsDateString()
  departureTime: Date;

  @IsDateString()
  arrivalTime: Date;
}

export class CheckAvailabilityDto {
  @IsDateString()
  departureTime: Date;

  @IsDateString()
  arrivalTime: Date;
}

export class ScheduleQueryDto {
  @IsDateString()
  startDate: Date;

  @IsDateString()
  endDate: Date;
}
