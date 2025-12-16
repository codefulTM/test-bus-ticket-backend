import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { BusService } from './bus.service';
import { Bus } from '../entities/bus.entity';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';

@Controller('buses')
export class BusController {
  constructor(private readonly busService: BusService) {}

  @Post()
  create(@Body() createBusDto: CreateBusDto): Promise<Bus> {
    return this.busService.create(createBusDto);
  }

  @Get()
  findAll(): Promise<Bus[]> {
    return this.busService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Bus> {
    return this.busService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateBusDto: UpdateBusDto): Promise<Bus> {
    return this.busService.update(id, updateBusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.busService.remove(id);
  }
}
