import { IsEmail, IsEnum, IsString, IsOptional } from 'class-validator';
import { OperatorStatus } from '../../entities/operator.entity';

export class UpdateOperatorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEnum(OperatorStatus)
  @IsOptional()
  status?: OperatorStatus;
}
