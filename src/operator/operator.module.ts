import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';
import { Operator } from '../entities/operator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Operator])],
  controllers: [OperatorController],
  providers: [OperatorService]
})
export class OperatorModule {}
