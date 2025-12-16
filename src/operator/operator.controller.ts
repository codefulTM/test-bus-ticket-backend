import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Put, 
  Delete,
  Query,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { OperatorService } from './operator.service';
import { Operator } from '../entities/operator.entity';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { OperatorStatus } from '../entities/operator.entity';

@Controller('operators')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @Post()
  async create(@Body() createOperatorDto: CreateOperatorDto): Promise<Operator> {
    return this.operatorService.create(createOperatorDto);
  }

  @Get()
  async findAll(): Promise<Operator[]> {
    return this.operatorService.findAll();
  }

  @Get('status/:status')
  async findByStatus(@Param('status') status: OperatorStatus): Promise<Operator[]> {
    return this.operatorService.findByStatus(status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateOperatorDto: UpdateOperatorDto): Promise<Operator> {
    return this.operatorService.update(id, updateOperatorDto);
  }

  @Put(':id/approve')
  async approve(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.approveOperator(id);
  }

  @Put(':id/suspend')
  async suspend(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.suspendOperator(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.operatorService.remove(id);
  }
}
