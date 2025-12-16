import { IsEmail, IsEnum, IsString, IsOptional } from 'class-validator';
import { OperatorStatus } from '../../entities/operator.entity';

export class CreateOperatorDto {
  @IsString()
  name: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  contactPhone: string;

  @IsEnum(OperatorStatus)
  @IsOptional()
  status?: OperatorStatus;
}
