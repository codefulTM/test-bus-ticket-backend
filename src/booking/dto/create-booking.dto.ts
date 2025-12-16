import { IsNotEmpty, IsString, IsArray, ValidateNested, IsUUID, ArrayMinSize, IsOptional, IsEmail, IsIn, ValidateIf, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class PassengerDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  documentId: string;

  @IsNotEmpty()
  @IsString()
  seatCode: string;

  @IsOptional()
  @IsString()
  @IsIn(['id', 'passport', 'license'])
  documentType?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @ValidateIf((o) => o.email && o.email.trim() !== '')
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;
}

export class SeatDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  type: 'normal' | 'vip' | 'business';

  @IsNotEmpty()
  price: number;
}

export class CreateBookingDto {
  @IsNotEmpty()
  @IsUUID()
  tripId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one seat must be selected' })
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats: SeatDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one passenger must be provided' })
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers: PassengerDto[];

  @IsNotEmpty()
  totalPrice: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  isGuestCheckout?: boolean;

  @IsOptional()
  @ValidateIf(o => o.isGuestCheckout === true)
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @ValidateIf(o => o.isGuestCheckout === true)
  @IsString()
  contactPhone?: string;
}