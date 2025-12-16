/**
 * WebSocket Gateway for Real-Time Seat Status Management
 * 
 * This gateway handles real-time seat locking and status updates
 * to prevent multiple users from selecting the same seat simultaneously.
 * 
 * Features:
 * - Seat locking with expiration (5 minutes)
 * - Real-time seat status broadcasting
 * - Automatic cleanup of expired locks
 * - Trip-based room management
 */

import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatStatus } from '../entities/seat-status.entity';
import { SeatState } from '../entities/seat-status.entity';

/**
 * Represents a temporary lock on a seat
 */
interface SeatLock {
    /** ID of the locked seat */
    seatId: string;
    /** ID of the user who locked the seat */
    userId: string;
    /** Socket connection ID of the user */
    socketId: string;
    /** ID of the trip the seat belongs to */
    tripId: string;
    /** When the lock expires (5 minutes from creation) */
    expiresAt: Date;
}

/**
 * Message structure for seat status updates
 */
interface SeatStatusUpdate {
    /** ID of the trip */
    tripId: string;
    /** ID of the seat */
    seatId: string;
    /** Current status of the seat */
    status: 'available' | 'locked' | 'booked';
    /** ID of the user who caused the status change */
    userId?: string;
}

/**
 * WebSocket Gateway Configuration
 * - Allows connections from frontend URL
 * - Uses '/seats' namespace for seat-related events
 * - Enables CORS for cross-origin requests
 */
@WebSocketGateway({
    cors: {
        origin: true,
        credentials: true,
    },
    namespace: '/seats',
})
export class SeatStatusGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    /** WebSocket server instance for broadcasting messages */
    @WebSocketServer()
    server: Server;

    /** Logger for debugging and monitoring */
    private readonly logger = new Logger(SeatStatusGateway.name);
    /** Storage for active seat locks (key: "tripId:seatId", value: SeatLock) */
    private seatLocks: Map<string, SeatLock> = new Map();
    /** How long locks last before expiring (5 minutes in milliseconds) */
    private readonly LOCK_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(SeatStatus)
        private readonly seatStatusRepository: Repository<SeatStatus>,
    ) {
        // Configure CORS dynamically based on environment
        this.updateCorsConfiguration();
    }

    /**
     * Updates CORS configuration based on environment variables
     * This method is called in constructor after ConfigService is available
     */
    private updateCorsConfiguration() {
        const frontendUrl = this.configService.get('FRONTEND_URL');
        const allowedOrigins = [
            frontendUrl || 'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8000',
        ].filter(Boolean); // Remove null/undefined values

        this.logger.log(`Frontend URL configured: ${frontendUrl || 'http://localhost:3000'}`);
        this.logger.log(`Allowed origins: ${allowedOrigins.join(', ')}`);

        // Update the server's CORS configuration dynamically
        if (this.server && this.server.httpServer) {
            const io = this.server as any;
            if (io.engine && io.engine.opts) {
                io.engine.opts.cors = {
                    origin: allowedOrigins,
                    credentials: true,
                };
            }
        }
    }

    /**
     * Called when a new client connects to the WebSocket
     * @param client - The connected socket client
     */
    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
        // Re-apply CORS configuration when first client connects
        // This ensures the configuration is active
        this.updateCorsConfiguration();
    }

    /**
     * Called when a client disconnects from the WebSocket
     * Automatically releases all locks held by the disconnected client
     * @param client - The disconnected socket client
     */
    async handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Release all locks held by this client
        await this.releaseClientLocks(client.id);
    }

    /**
     * Handles client joining a trip room to receive seat updates
     * Client receives current locked seats immediately upon joining
     */
    @SubscribeMessage('joinTrip')
    async handleJoinTrip(
        @MessageBody() data: { tripId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId } = data;
        // Add client to trip-specific room for targeted broadcasts
        client.join(`trip:${tripId}`);
        this.logger.log(`Client ${client.id} joined trip ${tripId}`);

        // Send current locked seats for this trip to the new client
        const lockedSeats = await this.getLockedSeatsForTrip(tripId);
        client.emit('currentLocks', { tripId, lockedSeats });

        return { success: true, tripId };
    }

    /**
     * Handles client leaving a trip room
     * Releases all locks held by the client for that specific trip
     */
    @SubscribeMessage('leaveTrip')
    async handleLeaveTrip(
        @MessageBody() data: { tripId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId } = data;
        // Remove client from trip room
        client.leave(`trip:${tripId}`);
        this.logger.log(`Client ${client.id} left trip ${tripId}`);

        // Release locks for this trip by this client
        await this.releaseClientLocksForTrip(client.id, tripId);

        return { success: true, tripId };
    }

    /**
     * Handles seat locking requests
     * Prevents double locking and broadcasts lock status to all clients
     */
    @SubscribeMessage('lockSeat')
    async handleLockSeat(
        @MessageBody() data: { tripId: string; seatId: string; userId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId, seatId, userId } = data;
        const lockKey = `${tripId}:${seatId}`;

        // Check if seat is already locked by someone else
        const existingLock = this.seatLocks.get(lockKey);
        if (existingLock && existingLock.socketId !== client.id) {
            // Check if lock has expired
            if (existingLock.expiresAt > new Date()) {
                return {
                    success: false,
                    message: 'Seat is already locked by another user',
                };
            }
        }

        // Create or update lock with 5-minute expiration
        const lock: SeatLock = {
            seatId,
            userId: userId || client.id,
            socketId: client.id,
            tripId,
            expiresAt: new Date(Date.now() + this.LOCK_DURATION),
        };

        this.seatLocks.set(lockKey, lock);

        // Save seat status to database
        try {
            await this.saveSeatStatus(tripId, seatId, SeatState.LOCKED, lock.expiresAt);
        } catch (error) {
            this.logger.error(`Failed to save seat status to database: ${error.message}`);
            // Continue with lock even if database save fails
        }

        // Notify all clients in the trip room about the new lock
        this.server.to(`trip:${tripId}`).emit('seatLocked', {
            tripId,
            seatId,
            userId: lock.userId,
            expiresAt: lock.expiresAt,
        });

        this.logger.log(`Seat ${seatId} locked for trip ${tripId} by ${userId || client.id}`);

        return { success: true, lock };
    }

    /**
     * Handles seat unlocking requests
     * Only the user who created the lock can unlock it
     */
    @SubscribeMessage('unlockSeat')
    async handleUnlockSeat(
        @MessageBody() data: { tripId: string; seatId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId, seatId } = data;
        const lockKey = `${tripId}:${seatId}`;

        const lock = this.seatLocks.get(lockKey);
        if (lock && lock.socketId === client.id) {
            this.seatLocks.delete(lockKey);

            // Update seat status in database
            try {
                await this.saveSeatStatus(tripId, seatId, SeatState.AVAILABLE, null);
            } catch (error) {
                this.logger.error(`Failed to update seat status in database: ${error.message}`);
                // Continue with unlock even if database update fails
            }

            // Notify all clients in the trip room that the seat is now available
            this.server.to(`trip:${tripId}`).emit('seatUnlocked', {
                tripId,
                seatId,
            });

            this.logger.log(`Seat ${seatId} unlocked for trip ${tripId}`);

            return { success: true };
        }

        return { success: false, message: 'You do not hold this lock' };
    }

    /**
     * Handles lock refresh requests to extend lock duration
     * Useful when user is still active but lock is about to expire
     */
    @SubscribeMessage('refreshLock')
    async handleRefreshLock(
        @MessageBody() data: { tripId: string; seatId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId, seatId } = data;
        const lockKey = `${tripId}:${seatId}`;

        const lock = this.seatLocks.get(lockKey);
        if (lock && lock.socketId === client.id) {
            // Extend lock by another 5 minutes
            lock.expiresAt = new Date(Date.now() + this.LOCK_DURATION);
            this.seatLocks.set(lockKey, lock);

            // Update seat status in database with new expiration time
            try {
                await this.saveSeatStatus(tripId, seatId, SeatState.LOCKED, lock.expiresAt);
            } catch (error) {
                this.logger.error(`Failed to update seat status in database: ${error.message}`);
                // Continue with lock refresh even if database update fails
            }

            return { success: true, expiresAt: lock.expiresAt };
        }

        return { success: false, message: 'Lock not found or expired' };
    }

    /**
     * Handles seat booking requests
     * Converts seat locks to booked status and removes locks
     * Only users who hold the lock can book the seat
     */
    @SubscribeMessage('bookSeat')
    async handleBookSeat(
        @MessageBody() data: { tripId: string; seatId: string; userId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId, seatId, userId } = data;
        const lockKey = `${tripId}:${seatId}`;

        // Check if seat is locked by this client
        const lock = this.seatLocks.get(lockKey);
        if (!lock) {
            return { success: false, message: 'Seat is not locked' };
        }

        if (lock.socketId !== client.id) {
            return { success: false, message: 'You do not hold the lock for this seat' };
        }

        // Check if lock has expired
        if (lock.expiresAt <= new Date()) {
            this.seatLocks.delete(lockKey);
            return { success: false, message: 'Lock has expired' };
        }

        // Remove the lock and update seat status to booked
        this.seatLocks.delete(lockKey);

        // Update seat status in database
        try {
            await this.saveSeatStatus(tripId, seatId, SeatState.BOOKED, null);
        } catch (error) {
            this.logger.error(`Failed to update seat status in database: ${error.message}`);
            // Continue with booking even if database update fails
        }

        // Notify all clients in the trip room that the seat is now booked
        this.server.to(`trip:${tripId}`).emit('seatBooked', {
            tripId,
            seatId,
            userId: userId || lock.userId,
        });

        this.logger.log(`Seat ${seatId} booked for trip ${tripId} by ${userId || lock.userId}`);

        return { success: true, seatId, userId: userId || lock.userId };
    }

    /**
     * Handles bulk seat booking requests
     * Books multiple seats at once for a trip
     * User must hold locks for all requested seats
     */
    @SubscribeMessage('bookSeats')
    async handleBookSeats(
        @MessageBody() data: { tripId: string; seatIds: string[]; userId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId, seatIds, userId } = data;
        const bookedSeats: string[] = [];
        const failedSeats: Array<{ seatId: string; reason: string }> = [];

        // Validate each seat
        for (const seatId of seatIds) {
            const lockKey = `${tripId}:${seatId}`;
            const lock = this.seatLocks.get(lockKey);

            if (!lock) {
                failedSeats.push({ seatId, reason: 'Seat is not locked' });
                continue;
            }

            if (lock.socketId !== client.id) {
                failedSeats.push({ seatId, reason: 'You do not hold the lock for this seat' });
                continue;
            }

            if (lock.expiresAt <= new Date()) {
                this.seatLocks.delete(lockKey);
                failedSeats.push({ seatId, reason: 'Lock has expired' });
                continue;
            }

            // All checks passed, proceed with booking
            this.seatLocks.delete(lockKey);
            bookedSeats.push(seatId);

            // Update seat status in database
            try {
                await this.saveSeatStatus(tripId, seatId, SeatState.BOOKED, null);
            } catch (error) {
                this.logger.error(`Failed to update seat status in database for seat ${seatId}: ${error.message}`);
                // Continue with booking even if database update fails
            }

            // Notify all clients that this seat is now booked
            this.server.to(`trip:${tripId}`).emit('seatBooked', {
                tripId,
                seatId,
                userId: userId || lock.userId,
            });
        }

        this.logger.log(`Bulk booking completed for trip ${tripId}: ${bookedSeats.length} successful, ${failedSeats.length} failed`);

        return {
            success: bookedSeats.length > 0,
            bookedSeats,
            failedSeats,
        };
    }

    /**
     * Handles seat cancellation requests
     * Converts booked seats back to available status
     */
    @SubscribeMessage('cancelSeat')
    async handleCancelSeat(
        @MessageBody() data: { tripId: string; seatId: string; userId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { tripId, seatId, userId } = data;

        // Update seat status in database to available
        try {
            await this.saveSeatStatus(tripId, seatId, SeatState.AVAILABLE, null);
        } catch (error) {
            this.logger.error(`Failed to update seat status in database: ${error.message}`);
            return { success: false, message: 'Failed to update seat status' };
        }

        // Notify all clients in the trip room that the seat is now available
        this.server.to(`trip:${tripId}`).emit('seatAvailable', {
            tripId,
            seatId,
            userId,
        });

        this.logger.log(`Seat ${seatId} cancelled for trip ${tripId} by ${userId || client.id}`);

        return { success: true, seatId };
    }

    /**
     * Called when seats are successfully booked
     * Removes locks and notifies all clients that seats are now booked
     * @param tripId - The trip ID
     * @param seatIds - Array of booked seat IDs
     */
    public notifySeatBooked(tripId: string, seatIds: string[]) {
        seatIds.forEach((seatId) => {
            const lockKey = `${tripId}:${seatId}`;
            this.seatLocks.delete(lockKey);

            // Notify all clients that seat is now booked
            this.server.to(`trip:${tripId}`).emit('seatBooked', {
                tripId,
                seatId,
            });
        });

        this.logger.log(`Seats ${seatIds.join(', ')} booked for trip ${tripId}`);
    }

    /**
     * Called when seats become available again (e.g., booking cancelled)
     * Notifies all clients that seats are now available for selection
     * @param tripId - The trip ID
     * @param seatIds - Array of now-available seat IDs
     */
    public notifySeatsAvailable(tripId: string, seatIds: string[]) {
        seatIds.forEach((seatId) => {
            this.server.to(`trip:${tripId}`).emit('seatAvailable', {
                tripId,
                seatId,
            });
        });

        this.logger.log(
            `Seats ${seatIds.join(', ')} now available for trip ${tripId}`,
        );
    }

    /**
     * Releases all locks held by a specific client (when they disconnect)
     * @param socketId - The socket ID of the disconnected client
     */
    private async releaseClientLocks(socketId: string) {
        const locksToRelease: string[] = [];

        this.seatLocks.forEach((lock, key) => {
            if (lock.socketId === socketId) {
                locksToRelease.push(key);
                // Notify other clients that these seats are now available
                this.server.to(`trip:${lock.tripId}`).emit('seatUnlocked', {
                    tripId: lock.tripId,
                    seatId: lock.seatId,
                });
            }
        });

        // Update seat status in database for all released locks
        for (const key of locksToRelease) {
            const lock = this.seatLocks.get(key);
            if (lock) {
                try {
                    await this.saveSeatStatus(lock.tripId, lock.seatId, SeatState.AVAILABLE, null);
                } catch (error) {
                    this.logger.error(`Failed to update seat status in database: ${error.message}`);
                    // Continue with lock release even if database update fails
                }
            }
        }

        locksToRelease.forEach((key) => this.seatLocks.delete(key));

        if (locksToRelease.length > 0) {
            this.logger.log(
                `Released ${locksToRelease.length} locks for disconnected client ${socketId}`,
            );
        }
    }

    /**
     * Releases locks for a specific client and trip only
     * @param socketId - The socket ID of the client
     * @param tripId - The trip ID
     */
    private async releaseClientLocksForTrip(socketId: string, tripId: string) {
        const locksToRelease: string[] = [];

        this.seatLocks.forEach((lock, key) => {
            if (lock.socketId === socketId && lock.tripId === tripId) {
                locksToRelease.push(key);
                this.server.to(`trip:${lock.tripId}`).emit('seatUnlocked', {
                    tripId: lock.tripId,
                    seatId: lock.seatId,
                });
            }
        });

        // Update seat status in database for all released locks
        for (const key of locksToRelease) {
            const lock = this.seatLocks.get(key);
            if (lock) {
                try {
                    await this.saveSeatStatus(lock.tripId, lock.seatId, SeatState.AVAILABLE, null);
                } catch (error) {
                    this.logger.error(`Failed to update seat status in database: ${error.message}`);
                    // Continue with lock release even if database update fails
                }
            }
        }

        locksToRelease.forEach((key) => this.seatLocks.delete(key));
    }

    /**
     * Gets all currently locked seats for a specific trip
     * Combines memory locks with database locks for complete picture
     * @param tripId - The trip ID
     * @returns Array of locked seat information
     */
    private async getLockedSeatsForTrip(tripId: string) {
        const lockedSeats: Array<{
            seatId: string;
            userId: string;
            expiresAt: Date;
        }> = [];

        // Get locked seats from memory (active WebSocket locks)
        this.seatLocks.forEach((lock) => {
            // Only include non-expired locks
            if (lock.tripId === tripId && lock.expiresAt > new Date()) {
                lockedSeats.push({
                    seatId: lock.seatId,
                    userId: lock.userId,
                    expiresAt: lock.expiresAt,
                });
            }
        });

        try {
            // Get locked seats from database
            const dbLockedSeats = await this.seatStatusRepository.find({
                where: {
                    tripId,
                    state: SeatState.LOCKED,
                },
            });

            // Add database locks that aren't already in memory
            dbLockedSeats.forEach((seatStatus) => {
                const isExpired = seatStatus.lockedUntil && new Date(seatStatus.lockedUntil) <= new Date();
                
                if (!isExpired) {
                    // Check if this seat is already in memory locks
                    const existingInMemory = lockedSeats.find(
                        (seat) => seat.seatId === seatStatus.seatId
                    );

                    if (!existingInMemory) {
                        lockedSeats.push({
                            seatId: seatStatus.seatId,
                            userId: seatStatus.bookingId || 'unknown', // Use bookingId as userId fallback
                            expiresAt: seatStatus.lockedUntil || new Date(Date.now() + this.LOCK_DURATION),
                        });
                    }
                }
            });

            // Clean up expired locks in database
            await this.cleanupExpiredLocksInDatabase(tripId);
        } catch (error) {
            this.logger.error(`Failed to get locked seats from database: ${error.message}`);
            // Continue with memory locks even if database query fails
        }

        return lockedSeats;
    }

    /**
     * Clean up expired locks in database for a specific trip
     * @param tripId - The trip ID
     */
    private async cleanupExpiredLocksInDatabase(tripId: string): Promise<void> {
        try {
            const expiredLocks = await this.seatStatusRepository.find({
                where: {
                    tripId,
                    state: SeatState.LOCKED,
                },
            });

            const now = new Date();
            const expiredIds: string[] = [];

            expiredLocks.forEach((lock) => {
                if (lock.lockedUntil && new Date(lock.lockedUntil) <= now) {
                    expiredIds.push(lock.id);
                }
            });

            if (expiredIds.length > 0) {
                await this.seatStatusRepository.update(expiredIds, {
                    state: SeatState.AVAILABLE,
                    lockedUntil: null,
                });
                this.logger.log(`Cleaned up ${expiredIds.length} expired locks in database for trip ${tripId}`);
            }
        } catch (error) {
            this.logger.error(`Failed to cleanup expired locks in database: ${error.message}`);
        }
    }

    /**
     * Starts automatic cleanup of expired locks
     * Runs every minute to remove locks that have passed their expiration time
     */
    startLockCleanup() {
        setInterval(async () => {
            const now = new Date();
            const expiredLocks: string[] = [];
            const affectedTrips: Set<string> = new Set();

            // Find and cleanup memory locks
            this.seatLocks.forEach((lock, key) => {
                if (lock.expiresAt <= now) {
                    expiredLocks.push(key);
                    affectedTrips.add(lock.tripId);
                    
                    // Notify clients that expired locks are now available
                    this.server.to(`trip:${lock.tripId}`).emit('seatUnlocked', {
                        tripId: lock.tripId,
                        seatId: lock.seatId,
                    });
                }
            });

            // Remove expired locks from memory
            expiredLocks.forEach((key) => this.seatLocks.delete(key));

            // Cleanup expired locks in database for affected trips
            for (const tripId of affectedTrips) {
                try {
                    await this.cleanupExpiredLocksInDatabase(tripId);
                } catch (error) {
                    this.logger.error(`Failed to cleanup expired locks in database for trip ${tripId}: ${error.message}`);
                }
            }

            if (expiredLocks.length > 0) {
                this.logger.log(`Cleaned up ${expiredLocks.length} expired locks from memory`);
            }
        }, 60000); // Check every minute
    }

    /**
     * Save or update seat status in database
     * @param tripId - ID of the trip
     * @param seatId - ID of the seat
     * @param state - New state of the seat
     * @param lockedUntil - When the lock expires (null if not locked)
     */
    private async saveSeatStatus(
        tripId: string,
        seatId: string,
        state: SeatState,
        lockedUntil: Date | null,
    ): Promise<void> {
        try {
            // Check if seat status already exists for this trip/seat combination
            const existingStatus = await this.seatStatusRepository.findOne({
                where: { tripId, seatId },
            });
            if (existingStatus) {
                // Update existing status
                await this.seatStatusRepository.update(existingStatus.id, {
                    state,
                    lockedUntil,
                });
            } else {
                // Create new status
                const newStatus = this.seatStatusRepository.create({
                    tripId,
                    seatId,
                    state,
                    lockedUntil,
                });
                const savedStatus = await this.seatStatusRepository.save(newStatus);
            }
        } catch (error) {
            console.error('Error saving seat status:', {
                tripId,
                seatId,
                state,
                lockedUntil,
                error: error instanceof Error ? error.message : error
            });
            throw new Error(`Failed to save seat status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
