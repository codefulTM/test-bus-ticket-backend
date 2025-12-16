import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { PointType } from '../../entities/route-point.entity';

export class CreateRoutePointDto {
  @ApiProperty({ description: 'Name of the point', example: 'Central Bus Station' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Latitude coordinate', example: 10.762622 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Longitude coordinate', example: 106.660172 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ 
    description: 'Type of the point', 
    enum: PointType, 
    example: PointType.BOTH 
  })
  @IsEnum(PointType)
  type: PointType;

  @ApiProperty({ 
    description: 'Order of the point in the route', 
    example: 1 
  })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiProperty({ 
    description: 'Distance from start in meters', 
    example: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  distanceFromStart?: number;

  @ApiProperty({ 
    description: 'Estimated time from start in minutes', 
    example: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  estimatedTimeFromStart?: number;
}
