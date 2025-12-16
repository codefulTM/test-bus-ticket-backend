import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PassengerUpdateDto {
  @IsNotEmpty()
  id: string; // ID of existing passenger detail

  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  documentId: string;

  @IsNotEmpty()
  seatCode: string;
}

export class UpdatePassengerDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerUpdateDto)
  passengers: PassengerUpdateDto[];
}