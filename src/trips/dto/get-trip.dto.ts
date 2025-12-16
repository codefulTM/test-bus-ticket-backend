import { IsBoolean, IsString } from "class-validator";

export class GetTripResponseDto {
  @IsBoolean()
  success: boolean;

  data: string;

  @IsString()
  message: string;

  @IsString()
  timestamp: string;
}