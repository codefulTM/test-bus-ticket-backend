import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

class PaymentItemDto {
  @IsString()
  name: string;

  @IsInt()
  quantity: number;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  taxPercentage?: number;
}

class InvoiceDto {
  @IsBoolean()
  @IsOptional()
  buyerNotGetInvoice?: boolean;

  @IsNumber()
  @IsOptional()
  taxPercentage?: number;
}

export class CreatePaymentDto {
  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  orderCode?: number;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  buyerName?: string;

  @IsString()
  @IsOptional()
  buyerCompanyName?: string;

  @IsString()
  @IsOptional()
  buyerTaxCode?: string;

  @IsString()
  @IsOptional()
  buyerAddress?: string;

  @IsEmail()
  @IsOptional()
  buyerEmail?: string;

  @IsString()
  @IsOptional()
  buyerPhone?: string;

  @IsArray()
  @IsOptional()
  @Type(() => PaymentItemDto)
  items?: PaymentItemDto[];

  @IsString()
  @IsOptional()
  cancelUrl?: string;

  @IsString()
  @IsOptional()
  returnUrl?: string;

  @IsOptional()
  invoice?: InvoiceDto;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  expiredAt?: number;

  @IsString()
  @IsOptional()
  signature?: string;
}
