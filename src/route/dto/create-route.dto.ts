import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRoutePointDto } from './create-route-point.dto';

export class CreateRouteDto {
  @ApiProperty({ description: 'ID of the operator that owns this route', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  operatorId: string;

  @ApiProperty({ description: 'Name of the route', example: 'HCM to Da Nang Express' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Starting point of the route', example: 'Ho Chi Minh City' })
  @IsString()
  origin: string;

  @ApiProperty({ description: 'Destination of the route', example: 'Da Nang' })
  @IsString()
  destination: string;

  @ApiProperty({ description: 'Distance in kilometers', example: 900, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  distanceKm?: number;

  @ApiProperty({ description: 'Estimated travel time in minutes', example: 720, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiProperty({ description: 'Description of the route', example: 'Direct route from Ho Chi Minh City to Da Nang' })
  @IsString()
  description: string;

  @ApiProperty({ 
    description: 'Whether the route is active', 
    example: true,
    default: true 
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ 
    description: 'List of amenities available on this route', 
    example: ['wifi', 'charging', 'toilet'],
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @ApiProperty({ 
    description: 'List of route points including pickup and dropoff locations',
    type: [CreateRoutePointDto],
    required: false
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoutePointDto)
  @IsOptional()
  points?: CreateRoutePointDto[];
}
