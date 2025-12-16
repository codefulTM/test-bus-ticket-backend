import { PartialType } from '@nestjs/swagger';
import { CreateRoutePointDto } from './create-route-point.dto';

export class UpdateRoutePointDto extends PartialType(CreateRoutePointDto) {
  // All properties are optional due to PartialType
}
