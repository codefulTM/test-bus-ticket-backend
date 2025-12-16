import { IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @IsOptional()
  @IsObject()
  paymentDetails?: any;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}