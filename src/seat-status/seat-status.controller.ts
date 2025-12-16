import { 
    Controller, 
    Get, 
    Param, 
    Post, 
    Body, 
    Patch, 
    Delete,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString, IsDate, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SeatStatusService } from './seat-status.service';
import { SeatStatus } from '../entities/seat-status.entity';
import { SeatState } from '../entities/seat-status.entity';

// DTOs for request body - moved to top to fix hoisting issue
export class CreateSeatStatusDto {
    tripId: string;
    seatId: string;
    state: SeatState;
    bookingId?: string;
    lockedUntil?: Date;
}

export class UpdateSeatStatusDto {
    @ApiProperty({ required: false, enum: SeatState })
    @IsOptional()
    @IsEnum(SeatState)
    state?: SeatState;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    bookingId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDate()
    lockedUntil?: Date;
}

@Controller('seat-status')
export class SeatStatusController {
    constructor(private readonly seatStatusService: SeatStatusService) {}

    /**
     * Get seat status by seat ID
     * GET /seat-status/seat/:seatId
     */
    @Get('seat/:seatId')
    async findBySeatId(@Param('seatId') seatId: string): Promise<SeatStatus[]> {
        const seatStatuses = await this.seatStatusService.findBySeatId(seatId);
        
        if (!seatStatuses || seatStatuses.length === 0) {
            throw new NotFoundException(`Seat status not found for seat ID: ${seatId}`);
        }
        
        return seatStatuses;
    }

    /**
     * Get seat status by seat ID and trip ID
     * GET /seat-status/seat/:seatId/trip/:tripId
     */
    @Get('seat/:seatId/trip/:tripId')
    async findBySeatIdAndTripId(
        @Param('seatId') seatId: string,
        @Param('tripId') tripId: string
    ): Promise<SeatStatus> {
        const seatStatus = await this.seatStatusService.findBySeatIdAndTripId(seatId, tripId);
        
        if (!seatStatus) {
            throw new NotFoundException(`Seat status not found for seat ID: ${seatId} and trip ID: ${tripId}`);
        }
        
        return seatStatus;
    }

    /**
     * Get all seat statuses for a trip
     * GET /seat-status/trip/:tripId
     */
    @Get('trip/:tripId')
    async findByTripId(@Param('tripId') tripId: string): Promise<SeatStatus[]> {
        const seatStatuses = await this.seatStatusService.findByTripId(tripId);
        
        if (!seatStatuses || seatStatuses.length === 0) {
            throw new NotFoundException(`No seat statuses found for trip ID: ${tripId}`);
        }
        
        return seatStatuses;
    }

    /**
     * Create a new seat status
     * POST /seat-status
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createSeatStatusDto: CreateSeatStatusDto): Promise<SeatStatus> {
        try {
            return await this.seatStatusService.create(createSeatStatusDto);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Update seat status
     * PATCH /seat-status/:id
     */
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateSeatStatusDto: UpdateSeatStatusDto
    ): Promise<SeatStatus> {
        try {
            const seatStatus = await this.seatStatusService.update(id, updateSeatStatusDto);
            
            if (!seatStatus) {
                throw new NotFoundException(`Seat status not found with ID: ${id}`);
            }
            
            return seatStatus;
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Delete seat status
     * DELETE /seat-status/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string): Promise<void> {
        try {
            const result = await this.seatStatusService.remove(id);
            
            if (!result) {
                throw new NotFoundException(`Seat status not found with ID: ${id}`);
            }
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Get locked seats for a trip
     * GET /seat-status/trip/:tripId/locked
     */
    @Get('trip/:tripId/locked')
    async getLockedSeats(@Param('tripId') tripId: string): Promise<SeatStatus[]> {
        try {
            return await this.seatStatusService.getLockedSeats(tripId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Get booked seats for a trip
     * GET /seat-status/trip/:tripId/booked
     */
    @Get('trip/:tripId/booked')
    async getBookedSeats(@Param('tripId') tripId: string): Promise<SeatStatus[]> {
        try {
            return await this.seatStatusService.getBookedSeats(tripId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Get available seats for a trip
     * GET /seat-status/trip/:tripId/available
     */
    @Get('trip/:tripId/available')
    async getAvailableSeats(@Param('tripId') tripId: string): Promise<SeatStatus[]> {
        try {
            return await this.seatStatusService.getAvailableSeats(tripId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }
}
