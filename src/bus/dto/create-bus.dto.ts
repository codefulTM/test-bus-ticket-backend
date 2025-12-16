import { IsArray, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreateBusDto {
  @IsUUID()
  operatorId: string;

  @IsString()
  plateNumber: string;

  @IsString()
  model: string;

  @IsNumber()
  seatCapacity: number;

  @IsArray()
  @IsString({ each: true })
  amenities: string[];
}
