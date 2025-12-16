import { IsString, IsEnum, IsNumber, IsObject, IsArray, IsBoolean, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { SeatLayoutType, SeatPricingConfig, SeatLayoutConfig } from '../../entities/seat-layout.entity';

export class SeatPositionDto {
  @IsNumber()
  row: number;

  @IsNumber()
  position: number;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

export class SeatInfoDto {
  @IsString()
  id: string;

  @IsString()
  code: string;

  @IsEnum(['normal', 'vip', 'business'])
  type: 'normal' | 'vip' | 'business';

  @IsObject()
  @ValidateNested()
  @Type(() => SeatPositionDto)
  position: SeatPositionDto;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class LayoutDimensionsDto {
  @IsNumber()
  totalWidth: number;

  @IsNumber()
  totalHeight: number;

  @IsNumber()
  seatWidth: number;

  @IsNumber()
  seatHeight: number;

  @IsNumber()
  aisleWidth: number;

  @IsNumber()
  rowSpacing: number;
}

export class SeatLayoutConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatInfoDto)
  seats: SeatInfoDto[];

  @IsArray()
  aisles: number[];

  @IsObject()
  @ValidateNested()
  @Type(() => LayoutDimensionsDto)
  dimensions: LayoutDimensionsDto;
}

export class SeatTypePricesDto {
  @IsNumber()
  @Min(0)
  normal: number;

  @IsNumber()
  @Min(0)
  vip: number;

  @IsNumber()
  @Min(0)
  business: number;
}

export class SeatPricingConfigDto {
  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsObject()
  @ValidateNested()
  @Type(() => SeatTypePricesDto)
  seatTypePrices: SeatTypePricesDto;

  @IsOptional()
  @IsObject()
  rowPricing?: { [rowNumber: number]: number };

  @IsOptional()
  @IsObject()
  positionPricing?: { [position: string]: number };
}

export class CreateSeatLayoutDto {
  @IsString()
  busId: string;

  @IsEnum(SeatLayoutType)
  layoutType: SeatLayoutType;

  @IsNumber()
  @Min(0)
  @Max(20)
  totalRows: number;

  @IsNumber()
  @Min(0)
  @Max(6)
  seatsPerRow: number;

  @IsObject()
  @ValidateNested()
  @Type(() => SeatLayoutConfigDto)
  layoutConfig: SeatLayoutConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SeatPricingConfigDto)
  seatPricing: SeatPricingConfigDto;
}

export class UpdateSeatLayoutDto {
  @IsEnum(SeatLayoutType)
  layoutType?: SeatLayoutType;

  @IsNumber()
  @Min(0)
  @Max(20)
  totalRows?: number;

  @IsNumber()
  @Min(0)
  @Max(6)
  seatsPerRow?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => SeatLayoutConfigDto)
  layoutConfig?: SeatLayoutConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SeatPricingConfigDto)
  seatPricing?: SeatPricingConfigDto;
}


// Template DTOs for predefined layouts
export class CreateSeatFromTemplateDto {
  @IsString()
  busId: string;

  @IsEnum(SeatLayoutType)
  layoutType: SeatLayoutType;

  @IsObject()
  @ValidateNested()
  @Type(() => SeatPricingConfigDto)
  seatPricing: SeatPricingConfigDto;
}

export interface TemplatesResponse {
  templates: LayoutTemplate[];
}

export interface LayoutTemplate {
  type: SeatLayoutType;
  name: string;
  description: string;
  totalSeats: number;
  preview: string;
}
