import { IsEmail, IsString } from 'class-validator';

export class GetGuestBookingDto {
  @IsEmail()
  contactEmail: string;

  @IsString()
  contactPhone: string;
}
