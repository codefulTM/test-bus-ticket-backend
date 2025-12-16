import { IsString, IsOptional, IsIn, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchTripsDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsISO8601()
  @Transform(({ value }) => new Date(value).toISOString())
  date: string; // ISO 8601 format (e.g., 2025-12-05T17:00:00.000Z)

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  passengers?: number = 1;

  @IsOptional()
  @IsIn(['standard', 'limousine', 'sleeper'])
  busType?: string;

  @IsOptional()
  @IsIn(['morning', 'afternoon', 'evening', 'night'])
  departureTime?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  maxPrice?: number;

  @IsOptional()
  @IsString()
  operatorId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
