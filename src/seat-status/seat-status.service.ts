import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatStatus } from '../entities/seat-status.entity';
import { SeatState } from '../entities/seat-status.entity';
import { CreateSeatStatusDto, UpdateSeatStatusDto } from './seat-status.controller';

@Injectable()
export class SeatStatusService {
    constructor(
        @InjectRepository(SeatStatus)
        private readonly seatStatusRepository: Repository<SeatStatus>,
    ) {}

    /**
     * Get seat status information by seat ID
     * @param seatId - ID of the seat to find
     * @returns Array of SeatStatus or empty array if not found
     */
    async findBySeatId(seatId: string): Promise<SeatStatus[]> {
        return await this.seatStatusRepository.find({
            where: { seatId },
            relations: ['trip', 'seat', 'booking'],
        });
    }

    /**
     * Get seat status for a specific seat in a specific trip
     * @param seatId - ID of the seat
     * @param tripId - ID of the trip
     * @returns SeatStatus or null if not found
     */
    async findBySeatIdAndTripId(seatId: string, tripId: string): Promise<SeatStatus | null> {
        return await this.seatStatusRepository.findOne({
            where: { seatId, tripId },
            relations: ['trip', 'seat', 'booking'],
        });
    }

    /**
     * Get all seat statuses for a specific trip
     * @param tripId - ID of the trip
     * @returns Array of SeatStatus
     */
    async findByTripId(tripId: string): Promise<SeatStatus[]> {
        return await this.seatStatusRepository.find({
            where: { tripId },
            relations: ['trip', 'seat', 'booking'],
        });
    }

    /**
     * Create a new seat status
     * @param createSeatStatusDto - Data to create seat status
     * @returns Created seat status
     */
    async create(createSeatStatusDto: CreateSeatStatusDto): Promise<SeatStatus> {
        const seatStatus = this.seatStatusRepository.create(createSeatStatusDto);
        return await this.seatStatusRepository.save(seatStatus);
    }

    /**
     * Update seat status
     * @param id - ID of the seat status to update
     * @param updateSeatStatusDto - Data to update
     * @returns Updated seat status
     */
    async update(id: string, updateSeatStatusDto: UpdateSeatStatusDto): Promise<SeatStatus | null> {
        await this.seatStatusRepository.update(id, updateSeatStatusDto);
        const seatStatus = await this.seatStatusRepository.findOne({
            where: { id },
            relations: ['trip', 'seat', 'booking'],
        });
        return seatStatus;
    }

    /**
     * Delete seat status
     * @param id - ID of the seat status to delete
     * @returns True if deleted, false if not found
     */
    async remove(id: string): Promise<boolean> {
        const result = await this.seatStatusRepository.delete(id);
        return (result.affected ?? 0) > 0;
    }

    /**
     * Get locked seats for a trip
     * @param tripId - ID of the trip
     * @returns Array of locked seat statuses
     */
    async getLockedSeats(tripId: string): Promise<SeatStatus[]> {
        return await this.seatStatusRepository.find({
            where: {
                tripId,
                state: SeatState.LOCKED,
            },
            relations: ['trip', 'seat', 'booking'],
        });
    }

    /**
     * Get booked seats for a trip
     * @param tripId - ID of the trip
     * @returns Array of booked seat statuses
     */
    async getBookedSeats(tripId: string): Promise<SeatStatus[]> {
        return await this.seatStatusRepository.find({
            where: {
                tripId,
                state: SeatState.BOOKED,
            },
            relations: ['trip', 'seat', 'booking'],
        });
    }

    /**
     * Get available seats for a trip
     * @param tripId - ID of the trip
     * @returns Array of available seat statuses
     */
    async getAvailableSeats(tripId: string): Promise<SeatStatus[]> {
        return await this.seatStatusRepository.find({
            where: {
                tripId,
                state: SeatState.AVAILABLE,
            },
            relations: ['trip', 'seat', 'booking'],
        });
    }
}
