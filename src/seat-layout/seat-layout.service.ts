import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SeatLayout, SeatLayoutType, SeatInfo, SeatPosition, SeatLayoutConfig, SeatPricingConfig } from '../entities/seat-layout.entity';
import { Bus } from '../entities/bus.entity';
import { Seat, SeatType } from '../entities/seat.entity';
import { SeatStatus } from '../entities/seat-status.entity';
import { CreateSeatLayoutDto, UpdateSeatLayoutDto, CreateSeatFromTemplateDto } from './dto/create-seat-layout.dto';

@Injectable()
export class SeatLayoutService {
  constructor(
    @InjectRepository(SeatLayout)
    private readonly seatLayoutRepository: Repository<SeatLayout>,
    @InjectRepository(Bus)
    private readonly busRepository: Repository<Bus>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    @InjectRepository(SeatStatus)
    private readonly seatStatusRepository: Repository<SeatStatus>,
  ) { }

  async create(createSeatLayoutDto: CreateSeatLayoutDto): Promise<SeatLayout> {
    // Verify bus exists
    const bus = await this.busRepository.findOne({
      where: { id: createSeatLayoutDto.busId },
    });

    if (!bus) {
      throw new NotFoundException(`Bus with ID ${createSeatLayoutDto.busId} not found`);
    }

    // Check if seat layout already exists for this bus
    const existingLayout = await this.seatLayoutRepository.findOne({
      where: { busId: createSeatLayoutDto.busId },
    });

    if (existingLayout) {
      throw new BadRequestException(`Seat layout already exists for bus ${createSeatLayoutDto.busId}`);
    }

    // Validate layout configuration
    this.validateLayoutConfig(createSeatLayoutDto);

    // Create seats in database based on layout config
    const createdSeats: Seat[] = [];
    if (createSeatLayoutDto.layoutConfig?.seats) {
      for (const seatInfo of createSeatLayoutDto.layoutConfig.seats) {
        const seat = this.seatRepository.create({
          seatCode: seatInfo.code,
          seatType: this.mapSeatType(seatInfo.type),
          isActive: true,
          busId: createSeatLayoutDto.busId,
        });
        const savedSeat = await this.seatRepository.save(seat);
        createdSeats.push(savedSeat);
      }

      // Update seat info IDs with actual database IDs
      const updatedSeats = createSeatLayoutDto.layoutConfig.seats.map((seatInfo, index) => ({
        ...seatInfo,
        id: createdSeats[index].id,
      }));

      // Update layout config with new seat IDs
      createSeatLayoutDto.layoutConfig.seats = updatedSeats;
    }

    const seatLayout = this.seatLayoutRepository.create({
      busId: createSeatLayoutDto.busId,
      layoutType: createSeatLayoutDto.layoutType,
      totalRows: createSeatLayoutDto.totalRows,
      seatsPerRow: createSeatLayoutDto.seatsPerRow,
      layoutConfig: createSeatLayoutDto.layoutConfig as any, // Type casting for complex nested objects
      seatPricing: createSeatLayoutDto.seatPricing as any,
    });
    return await this.seatLayoutRepository.save(seatLayout);
  }

  async createFromTemplate(createFromTemplateDto: CreateSeatFromTemplateDto): Promise<SeatLayout> {
    const bus = await this.busRepository.findOne({
      where: { id: createFromTemplateDto.busId },
    });

    if (!bus) {
      throw new NotFoundException(`Bus with ID ${createFromTemplateDto.busId} not found`);
    }

    const existingLayout = await this.seatLayoutRepository.findOne({
      where: { busId: createFromTemplateDto.busId },
    });

    if (existingLayout) {
      throw new BadRequestException(`Seat layout already exists for bus ${createFromTemplateDto.busId}`);
    }

    const templateConfig = this.getTemplateConfig(createFromTemplateDto.layoutType);

    // Create seats in database based on template
    const createdSeats: Seat[] = [];
    for (const seatInfo of templateConfig.layoutConfig.seats) {
      const seat = this.seatRepository.create({
        seatCode: seatInfo.code,
        seatType: this.mapSeatType(seatInfo.type),
        isActive: true,
        busId: createFromTemplateDto.busId,
      });
      const savedSeat = await this.seatRepository.save(seat);
      createdSeats.push(savedSeat);
    }

    // Update seat info IDs with actual database IDs
    const updatedSeats = templateConfig.layoutConfig.seats.map((seatInfo, index) => ({
      ...seatInfo,
      id: createdSeats[index].id,
    }));

    const seatLayout = this.seatLayoutRepository.create({
      busId: createFromTemplateDto.busId,
      layoutType: createFromTemplateDto.layoutType,
      totalRows: templateConfig.totalRows,
      seatsPerRow: templateConfig.seatsPerRow,
      layoutConfig: {
        ...templateConfig.layoutConfig,
        seats: updatedSeats,
      },
      seatPricing: createFromTemplateDto.seatPricing,
    });

    return await this.seatLayoutRepository.save(seatLayout);
  }

  async findAll(): Promise<SeatLayout[]> {
    return await this.seatLayoutRepository.find({
      relations: ['bus'],
    });
  }

  async findOne(id: string): Promise<SeatLayout> {
    const seatLayout = await this.seatLayoutRepository.findOne({
      where: { id },
      relations: ['bus'],
    });

    if (!seatLayout) {
      throw new NotFoundException(`Seat layout with ID ${id} not found`);
    }

    return seatLayout;
  }

  async findByBusId(busId: string): Promise<SeatLayout> {
    const seatLayout = await this.seatLayoutRepository.findOne({
      where: { busId },
      relations: ['bus'],
    });
    // console.log(seatLayout?.layoutConfig.seats);

    if (!seatLayout) {
      throw new NotFoundException(`Seat layout for bus ${busId} not found`);
    }

    return seatLayout;
  }

  async update(id: string, updateSeatLayoutDto: UpdateSeatLayoutDto): Promise<SeatLayout> {
    const seatLayout = await this.findOne(id);

    if (updateSeatLayoutDto.layoutConfig) {
      // Create a temporary object with the updated config for validation
      const tempConfig = { ...seatLayout, ...updateSeatLayoutDto };
      this.validateLayoutConfig(tempConfig as any);

      // Ensure seats array exists to maintain reference
      if (!updateSeatLayoutDto.layoutConfig.seats) {
        updateSeatLayoutDto.layoutConfig.seats = [];
      }

      // Handle seat updates - this will update newSeat.id with database UUIDs
      // updateSeats modifies the seats array in-place, updating IDs with database UUIDs
      await this.updateSeats(seatLayout.busId, seatLayout.layoutConfig?.seats || [], updateSeatLayoutDto.layoutConfig.seats);
    }
    // console.log(updateSeatLayoutDto.layoutConfig?.seats);
    Object.assign(seatLayout, updateSeatLayoutDto);
    return await this.seatLayoutRepository.save(seatLayout);
  }

  /**
   * Update seats based on new layout configuration
   * @param busId - Bus ID
   * @param oldSeats - Existing seats from layout
   * @param newSeats - New seats from updated layout
   */
  private async updateSeats(busId: string, oldSeats: any[], newSeats: any[]): Promise<void> {
    const oldSeatCodes = new Set(oldSeats.map(seat => seat.code));
    const newSeatCodes = new Set(newSeats.map(seat => seat.code));

    // Delete seats that are no longer in the layout
    const seatsToDelete = oldSeats.filter(seat => !newSeatCodes.has(seat.code));
    if (seatsToDelete.length > 0) {
      // First delete related seat status records to avoid foreign key constraint
      const seatIdsToDelete = seatsToDelete.map(seat => seat.id);
      await this.seatStatusRepository.delete({ seatId: In(seatIdsToDelete) });
      // Then delete the seats
      await this.seatRepository.delete(seatIdsToDelete);
    }
    // Create or update seats
    for (const newSeat of newSeats) {
      const existingSeat = oldSeats.find(seat => seat.code === newSeat.code);
      if (existingSeat) {
        // Update existing seat
        await this.seatRepository.update(existingSeat.id, {
          seatType: this.mapSeatType(newSeat.type),
          isActive: true,
        });
        newSeat.id = existingSeat.id;
      } else {
        // Create new seat
        const seat = this.seatRepository.create({
          seatCode: newSeat.code,
          seatType: this.mapSeatType(newSeat.type),
          isActive: true,
          busId,
        });
        const savedSeat = await this.seatRepository.save(seat);
        // console.log(savedSeat);
        newSeat.id = savedSeat.id; // Update with actual database ID
      }
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.seatLayoutRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Seat layout with ID ${id} not found`);
    }
  }

  private validateLayoutConfig(layoutConfig: any): void {
    const { layoutType, totalRows, seatsPerRow, layoutConfig: config } = layoutConfig;

    if (!config || !config.seats || !config.dimensions) {
      throw new BadRequestException('Invalid layout configuration');
    }

    // Validate seat count matches configuration
    const expectedSeatCount = totalRows * seatsPerRow;
    const actualSeatCount = config.seats.length;

    // For custom layouts, allow empty configuration
    if (layoutType !== SeatLayoutType.CUSTOM && actualSeatCount !== expectedSeatCount) {
      throw new BadRequestException(
        `Seat count mismatch: expected ${expectedSeatCount} seats, got ${actualSeatCount}`
      );
    }

    // Validate seat positions are within bounds (only if there are seats)
    for (const seat of config.seats) {
      if (seat.position.row > totalRows || seat.position.position > seatsPerRow) {
        throw new BadRequestException(`Invalid seat position: ${seat.code}`);
      }
    }
  }

  getTemplateConfig(layoutType: SeatLayoutType): {
    totalRows: number;
    seatsPerRow: number;
    layoutConfig: SeatLayoutConfig;
  } {
    const templates = {
      [SeatLayoutType.STANDARD_2X2]: this.createStandard2x2Template(),
      [SeatLayoutType.STANDARD_2X3]: this.createStandard2x3Template(),
      [SeatLayoutType.VIP_1X2]: this.createVip1x2Template(),
      [SeatLayoutType.SLEEPER_1X2]: this.createSleeper1x2Template(),
      [SeatLayoutType.CUSTOM]: this.createCustomTemplate(),
    };

    return templates[layoutType] || templates[SeatLayoutType.STANDARD_2X2];
  }

  /**
   * Map seat info type to Seat enum
   * @param type - Seat type from template
   * @returns SeatType enum value
   */
  private mapSeatType(type: string): SeatType {
    switch (type.toLowerCase()) {
      case 'vip':
        return SeatType.VIP;
      case 'business':
        return SeatType.BUSINESS;
      case 'normal':
      case 'standard':
      case 'economy':
      default:
        return SeatType.NORMAL;
    }
  }

  private createStandard2x2Template() {
    const rows = 12;
    const seatsPerRow = 2;
    const seatWidth = 40;
    const seatHeight = 40;
    const aisleWidth = 30;
    const rowSpacing = 10;

    const seats: SeatInfo[] = [];

    for (let row = 1; row <= rows; row++) {
      for (let pos = 1; pos <= seatsPerRow; pos++) {
        const seat: SeatInfo = {
          id: `seat-${row}-${pos}`,
          code: `${row}${String.fromCharCode(64 + pos)}`,
          type: 'normal',
          position: {
            row,
            position: pos,
            x: (pos - 1) * (seatWidth + aisleWidth),
            y: (row - 1) * (seatHeight + rowSpacing),
            width: seatWidth,
            height: seatHeight,
          },
          isAvailable: true,
        };
        seats.push(seat);
      }
    }

    return {
      totalRows: rows,
      seatsPerRow,
      layoutConfig: {
        seats,
        aisles: [1], // Aisle after first seat
        dimensions: {
          totalWidth: seatsPerRow * seatWidth + aisleWidth,
          totalHeight: rows * (seatHeight + rowSpacing),
          seatWidth,
          seatHeight,
          aisleWidth,
          rowSpacing,
        },
      },
    };
  }

  private createStandard2x3Template() {
    const rows = 10;
    const seatsPerRow = 3;
    const seatWidth = 35;
    const seatHeight = 40;
    const aisleWidth = 25;
    const rowSpacing = 10;

    const seats: SeatInfo[] = [];

    for (let row = 1; row <= rows; row++) {
      for (let pos = 1; pos <= seatsPerRow; pos++) {
        const seat: SeatInfo = {
          id: `seat-${row}-${pos}`,
          code: `${row}${String.fromCharCode(64 + pos)}`,
          type: pos === 2 ? 'vip' : 'normal', // Middle seat is VIP
          position: {
            row,
            position: pos,
            x: pos > 1 ? (pos - 1) * seatWidth + aisleWidth : 0,
            y: (row - 1) * (seatHeight + rowSpacing),
            width: seatWidth,
            height: seatHeight,
          },
          isAvailable: true,
        };
        seats.push(seat);
      }
    }

    return {
      totalRows: rows,
      seatsPerRow,
      layoutConfig: {
        seats,
        aisles: [1, 2], // Aisles after first and second seats
        dimensions: {
          totalWidth: seatsPerRow * seatWidth + aisleWidth * 2,
          totalHeight: rows * (seatHeight + rowSpacing),
          seatWidth,
          seatHeight,
          aisleWidth,
          rowSpacing,
        },
      },
    };
  }

  private createVip1x2Template() {
    const rows = 8;
    const seatsPerRow = 2;
    const seatWidth = 50;
    const seatHeight = 50;
    const aisleWidth = 40;
    const rowSpacing = 15;

    const seats: SeatInfo[] = [];

    for (let row = 1; row <= rows; row++) {
      for (let pos = 1; pos <= seatsPerRow; pos++) {
        const seat: SeatInfo = {
          id: `seat-${row}-${pos}`,
          code: `${row}${String.fromCharCode(64 + pos)}`,
          type: 'vip',
          position: {
            row,
            position: pos,
            x: (pos - 1) * (seatWidth + aisleWidth),
            y: (row - 1) * (seatHeight + rowSpacing),
            width: seatWidth,
            height: seatHeight,
          },
          isAvailable: true,
        };
        seats.push(seat);
      }
    }

    return {
      totalRows: rows,
      seatsPerRow,
      layoutConfig: {
        seats,
        aisles: [1],
        dimensions: {
          totalWidth: seatsPerRow * seatWidth + aisleWidth,
          totalHeight: rows * (seatHeight + rowSpacing),
          seatWidth,
          seatHeight,
          aisleWidth,
          rowSpacing,
        },
      },
    };
  }

  private createSleeper1x2Template() {
    const rows = 6;
    const seatsPerRow = 2;
    const seatWidth = 60;
    const seatHeight = 80;
    const aisleWidth = 40;
    const rowSpacing = 20;

    const seats: SeatInfo[] = [];

    for (let row = 1; row <= rows; row++) {
      for (let pos = 1; pos <= seatsPerRow; pos++) {
        const seat: SeatInfo = {
          id: `seat-${row}-${pos}`,
          code: `${row}${String.fromCharCode(64 + pos)}`,
          type: 'business',
          position: {
            row,
            position: pos,
            x: (pos - 1) * (seatWidth + aisleWidth),
            y: (row - 1) * (seatHeight + rowSpacing),
            width: seatWidth,
            height: seatHeight,
          },
          isAvailable: true,
        };
        seats.push(seat);
      }
    }

    return {
      totalRows: rows,
      seatsPerRow,
      layoutConfig: {
        seats,
        aisles: [1],
        dimensions: {
          totalWidth: seatsPerRow * seatWidth + aisleWidth,
          totalHeight: rows * (seatHeight + rowSpacing),
          seatWidth,
          seatHeight,
          aisleWidth,
          rowSpacing,
        },
      },
    };
  }

  private createCustomTemplate() {
    const rows = 0;
    const seatsPerRow = 0;
    const seatWidth = 40;
    const seatHeight = 40;
    const aisleWidth = 40;
    const rowSpacing = 20;

    const seats: SeatInfo[] = [];

    return {
      totalRows: rows,
      seatsPerRow,
      layoutConfig: {
        seats,
        aisles: [],
        dimensions: {
          totalWidth: 0,
          totalHeight: 0,
          seatWidth,
          seatHeight,
          aisleWidth,
          rowSpacing,
        },
      },
    };
  }
}
