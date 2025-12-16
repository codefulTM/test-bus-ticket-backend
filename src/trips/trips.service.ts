import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Brackets,
  In,
  LessThan,
  MoreThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  And,
  Not,
} from 'typeorm';
import { Trip, TripStatus } from '../entities/trip.entity';
import { Route } from '../entities/route.entity';
import { Bus } from '../entities/bus.entity';
import { SeatStatus } from '../entities/seat-status.entity';
import { SearchTripsDto } from './dto/search-trips.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { start } from 'repl';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,

    @InjectRepository(SeatStatus)
    private readonly seatStatusRepo: Repository<SeatStatus>,

    @InjectRepository(Bus)
    private readonly busRepository: Repository<Bus>,

    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
  ) { }

  // helper: convert "morning/afternoon/..." into a range of hours
  private getTimeRangeForBucket(bucket: string) {
    // local times (24h) considered for departureTime field
    switch (bucket) {
      case 'morning': return { start: '05:00:00', end: '11:59:59' }; // 5:00 - 11:59
      case 'afternoon': return { start: '12:00:00', end: '16:59:59' }; // 12:00 - 16:59
      case 'evening': return { start: '17:00:00', end: '20:59:59' }; // 17:00 - 20:59
      case 'night': return { start: '21:00:00', end: '04:59:59' }; // 21:00 - 04:59 (spans midnight)
      default: return null;
    }
  }

  // Check if a bus is available for a specific time slot
  private async checkBusAvailability(
    busId: string,
    departureTime: Date,
    arrivalTime: Date,
    excludeTripId?: string,
  ): Promise<boolean> {
    const conflictingTrips = await this.tripRepo.find({
      where: [
        // Trip that starts during our proposed time
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          departureTime: And(LessThan(arrivalTime), MoreThanOrEqual(departureTime)),
        },
        // Trip that ends during our proposed time
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          arrivalTime: And(LessThanOrEqual(arrivalTime), MoreThan(departureTime)),
        },
        // Trip that completely encompasses our proposed time
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          departureTime: LessThanOrEqual(departureTime),
          arrivalTime: MoreThanOrEqual(arrivalTime),
        },
        // Our proposed time completely encompasses the trip
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          departureTime: MoreThanOrEqual(departureTime),
          arrivalTime: LessThanOrEqual(arrivalTime),
        },
      ],
    });

    if (excludeTripId) {
      return conflictingTrips.every(trip => trip.id !== excludeTripId);
    }

    return conflictingTrips.length === 0;
  }

  // Validate that the route and bus are compatible (same operator)
  private async validateRouteBusCompatibility(routeId: string, busId: string): Promise<void> {
    const route = await this.routeRepository.findOne({
      where: { id: routeId },
      select: ['operatorId'],
    });

    if (!route) {
      throw new NotFoundException(`Route with ID ${routeId} not found`);
    }

    const bus = await this.busRepository.findOne({
      where: { id: busId },
      select: ['operatorId'],
    });

    if (!bus) {
      throw new NotFoundException(`Bus with ID ${busId} not found`);
    }

    if (route.operatorId !== bus.operatorId) {
      throw new BadRequestException(
        `Bus and route must belong to the same operator. ` +
        `Route operator: ${route.operatorId}, Bus operator: ${bus.operatorId}`,
      );
    }
  }

  // Validate time logic (departure must be before arrival, reasonable times)
  private validateTripTiming(departureTime: Date, arrivalTime: Date): void {
    if (departureTime >= arrivalTime) {
      throw new BadRequestException('Departure time must be before arrival time');
    }

    const now = new Date();
    if (departureTime < now) {
      throw new BadRequestException('Departure time cannot be in the past');
    }

    const durationHours = (arrivalTime.getTime() - departureTime.getTime()) / (1000 * 60 * 60);
    if (durationHours > 48) {
      throw new BadRequestException('Trip duration cannot exceed 48 hours');
    }

    if (durationHours < 0.25) {
      throw new BadRequestException('Trip duration must be at least 15 minutes');
    }
  }

  // POST /trips
  async create(createTripDto: CreateTripDto): Promise<Trip> {
    const { routeId, busId, departureTime, arrivalTime } = createTripDto;

    this.validateTripTiming(new Date(departureTime), new Date(arrivalTime));

    await this.validateRouteBusCompatibility(routeId, busId);

    const isBusAvailable = await this.checkBusAvailability(
      busId,
      new Date(departureTime),
      new Date(arrivalTime),
    );

    if (!isBusAvailable) {
      throw new ConflictException('Bus is already scheduled for this time period');
    }

    const trip = this.tripRepo.create(createTripDto);
    return await this.tripRepo.save(trip);
  }

  // GET /trips
  async findAll(): Promise<Trip[]> {
    return await this.tripRepo.find({
      relations: ['route', 'bus', 'bookings', 'seatStatuses', 'feedbacks'],
      order: { departureTime: 'ASC' },
    });
  }

  // GET /trips/admin/{:tripId}
  async findOne(id: string): Promise<Trip> {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: ['route', 'bus', 'bookings', 'seatStatuses', 'feedbacks'],
    });

    if (!trip) {
      throw new NotFoundException(`Trip with ID ${id} not found`);
    }

    return trip;
  }

  // PUT /trips/{:tridId}
  async update(id: string, updateTripDto: UpdateTripDto): Promise<Trip> {
    const trip = await this.findOne(id);

    if (updateTripDto.departureTime || updateTripDto.arrivalTime) {
      const newDepartureTime = updateTripDto.departureTime
        ? new Date(updateTripDto.departureTime)
        : trip.departureTime;
      const newArrivalTime = updateTripDto.arrivalTime
        ? new Date(updateTripDto.arrivalTime)
        : trip.arrivalTime;

      this.validateTripTiming(newDepartureTime, newArrivalTime);

      const newBusId = updateTripDto.busId || trip.busId;
      if (newBusId !== trip.busId || updateTripDto.departureTime || updateTripDto.arrivalTime) {
        const isBusAvailable = await this.checkBusAvailability(
          newBusId,
          newDepartureTime,
          newArrivalTime,
          id,
        );

        if (!isBusAvailable) {
          throw new ConflictException('Bus is already scheduled for this time period');
        }
      }
    }

    if (updateTripDto.busId && updateTripDto.busId !== trip.busId) {
      const routeId = (updateTripDto).routeId || trip.routeId;
      await this.validateRouteBusCompatibility(routeId, updateTripDto.busId);
    }

    Object.assign(trip, updateTripDto);
    return await this.tripRepo.save(trip);
  }

  // DELETE /trips/{:tripId}
  async remove(id: string): Promise<void> {
    const trip = await this.findOne(id);

    if (trip.bookings && trip.bookings.length > 0) {
      throw new ConflictException('Cannot delete trip with existing bookings');
    }

    await this.tripRepo.remove(trip);
  }

  // Get available buses for a specific time slot
  async getAvailableBuses(departureTime: Date, arrivalTime: Date): Promise<string[]> {
    const allBuses = await this.busRepository.find({
      select: ['id'],
    });

    const bookedBusIds = await this.getBookedBusIds(departureTime, arrivalTime);

    const availableBusIds = allBuses
      .filter(bus => !bookedBusIds.includes(bus.id))
      .map(bus => bus.id);

    return availableBusIds;
  }

  // Helper method to get bus IDs that are booked during a time period
  private async getBookedBusIds(departureTime: Date, arrivalTime: Date): Promise<string[]> {
    const conflictingTrips = await this.tripRepo.find({
      where: [
        {
          status: Not(TripStatus.CANCELLED),
          departureTime: And(LessThan(arrivalTime), MoreThan(departureTime)),
        },
        {
          status: Not(TripStatus.CANCELLED),
          arrivalTime: And(LessThan(arrivalTime), MoreThan(departureTime)),
        },
        {
          status: Not(TripStatus.CANCELLED),
          departureTime: LessThan(departureTime),
          arrivalTime: MoreThan(arrivalTime),
        },
      ],
      select: ['busId'],
    });

    return [...new Set(conflictingTrips.map(trip => trip.busId))];
  }

  // Get trips for a specific bus within a date range
  async getBusSchedule(busId: string, startDate: Date, endDate: Date): Promise<Trip[]> {
    return await this.tripRepo.find({
      where: {
        busId,
        departureTime: And(LessThan(endDate), MoreThan(startDate)),
        status: Not(TripStatus.CANCELLED),
      },
      relations: ['route'],
      order: { departureTime: 'ASC' },
    });
  }

  // Get trips for a specific route within a date range
  async getRouteSchedule(routeId: string, startDate: Date, endDate: Date): Promise<Trip[]> {
    return await this.tripRepo.find({
      where: {
        routeId,
        departureTime: And(LessThan(endDate), MoreThan(startDate)),
        status: Not(TripStatus.CANCELLED),
      },
      relations: ['bus'],
      order: { departureTime: 'ASC' },
    });
  }

  // Assign a bus to a route with conflict checking
  async assignBusToRoute(
    routeId: string,
    busId: string,
    departureTime: Date,
    arrivalTime: Date,
  ): Promise<{ success: boolean; message: string; available?: boolean }> {
    this.validateTripTiming(departureTime, arrivalTime);

    await this.validateRouteBusCompatibility(routeId, busId);

    const isBusAvailable = await this.checkBusAvailability(busId, departureTime, arrivalTime);

    if (!isBusAvailable) {
      return {
        success: false,
        message: 'Bus is already scheduled for this time period',
        available: false,
      };
    }

    return {
      success: true,
      message: 'Bus is available for assignment to this route',
      available: true,
    };
  }

  // Get all trips that conflict with a proposed time slot for a specific bus
  async getConflictingTrips(
    busId: string,
    departureTime: Date,
    arrivalTime: Date,
  ): Promise<Trip[]> {
    return await this.tripRepo.find({
      where: [
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          departureTime: And(LessThan(arrivalTime), MoreThan(departureTime)),
        },
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          arrivalTime: And(LessThan(arrivalTime), MoreThan(departureTime)),
        },
        {
          busId,
          status: Not(TripStatus.CANCELLED),
          departureTime: LessThan(departureTime),
          arrivalTime: MoreThan(arrivalTime),
        },
      ],
      relations: ['route'],
      order: { departureTime: 'ASC' },
    });
  }

  async getSeats(trip: Trip) {
    const totalSeats = trip.bus?.seatCapacity ?? 0;

    const bookedSeats = await this.seatStatusRepo.count({
      where: {
        tripId: trip.id,
        state: In(['booked', 'reserved', 'locked']),
      },
    });

    const availableSeats = totalSeats - bookedSeats;

    return {
      totalSeats,
      availableSeats,
      occupancyRate: totalSeats ? Math.round(((totalSeats - availableSeats) / totalSeats) * 10000) / 100 : null,
    };
  }

  // GET /trips/search 
  async search(dto: SearchTripsDto) {
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 20, 100);
    const offset = (page - 1) * limit;
    console.log(dto.date);

    const qb = this.tripRepo.createQueryBuilder('trip')
      // join route, bus, operator — adapt relation names to your entities
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.bus', 'bus')
      .leftJoinAndSelect('bus.operator', 'operator');

    // Required: origin/destination/date - assume route has origin/destination,
    // trip has departureTime (timestamp)
    qb.andWhere('LOWER(route.origin) = LOWER(:origin)', { origin: dto.origin.trim() });
    qb.andWhere('LOWER(route.destination) = LOWER(:destination)', { destination: dto.destination.trim() });

    // date filter: trips whose departure date = dto.date (timezone note: store timestamps in UTC)
    // We compare date part by bounding between start and end of the day in UTC or DB timezone.
    const startDate = new Date(dto.date);
    startDate.setUTCHours(0, 0, 0, 0);
    const startOfDay = startDate.toISOString();
    // console.log(startOfDay);
    const endDate = new Date(dto.date);
    endDate.setUTCHours(23, 59, 59, 999);
    const endOfDay = endDate.toISOString();
    // console.log(endOfDay);
    qb.andWhere('trip.departureTime BETWEEN :startOfDay AND :endOfDay', { startOfDay, endOfDay });



    // optional filters
    if (dto.busType) {
      qb.andWhere('bus.busType = :busType', { busType: dto.busType });
    }

    if (dto.operatorId) {
      qb.andWhere('operator.id = :operatorId', { operatorId: dto.operatorId });
    }

    if (dto.minPrice != null) {
      qb.andWhere('trip.basePrice >= :minPrice', { minPrice: dto.minPrice });
    }

    if (dto.maxPrice != null) {
      qb.andWhere('trip.basePrice <= :maxPrice', { maxPrice: dto.maxPrice });
    }

    // departureTime bucket (morning/afternoon/evening/night)
    if (dto.departureTime) {
      const range = this.getTimeRangeForBucket(dto.departureTime);
      if (range) {
        if (dto.departureTime !== 'night') {
          qb.andWhere(`to_char(trip.departureTime::time, 'HH24:MI:SS') BETWEEN :start AND :end`, {
            start: range.start,
            end: range.end,
          });
        } else {
          // night spans midnight: accept times >= 21:00 OR <= 04:59:59
          qb.andWhere(new Brackets(q => {
            q.where(`to_char(trip.departureTime::time, 'HH24:MI:SS') >= :start`, { start: range.start })
              .orWhere(`to_char(trip.departureTime::time, 'HH24:MI:SS') <= :end`, { end: range.end });
          }));
        }
      }
    }

    // ordering — cheapest first as example, then departureTime
    qb.orderBy('trip.basePrice', 'ASC')
      .addOrderBy('trip.departureTime', 'ASC');

    // count total
    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();

    // Map each Trip entity to response shape required by README:
    const data = await Promise.all(items.map(async trip => {
      const seats = await this.getSeats(trip);

      return {
        tripId: trip.id,
        route: {
          routeId: trip.route?.id,
          origin: trip.route?.origin,
          destination: trip.route?.destination,
          distanceKm: trip.route?.distanceKm,
          estimatedMinutes: trip.route?.estimatedMinutes,
        },
        operator: {
          operatorId: trip.bus?.operator?.id,
          name: trip.bus?.operator?.name,
          rating: null, // not defined in entity
          logo: null, // not defined in entity
        },
        bus: {
          busId: trip.bus?.id,
          model: trip.bus?.model,
          plateNumber: trip.bus?.plateNumber,
          seatCapacity: trip.bus?.seatCapacity,
          busType: null, // not defined in entity
          amenities: trip.bus?.amenities ?? [],
        },
        schedule: {
          departureTime: trip.departureTime,
          arrivalTime: trip.arrivalTime,
          duration: trip.arrivalTime && trip.departureTime
            ? Math.round((new Date(trip.arrivalTime).getTime() - new Date(trip.departureTime).getTime()) / 60000)
            : null,
        },
        pricing: {
          basePrice: trip.basePrice,
          currency: 'VND', // not defined in entity
          serviceFee: 0, // not defined in entity
        },
        availability: {
          totalSeats: seats.totalSeats,
          availableSeats: seats.availableSeats,
          occupancyRate: seats.occupancyRate,
        },
        status: trip.status,
      };
    }));

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return { data, pagination };
  }

  // GET /trips/{:tripId}
  async getTripById(tripId: string) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: {
        route: true,
        bus: {
          operator: true,
        },
      }
    });

    if (!trip) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'TRIP_001',
          message: 'trip not found',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate duration
    const durationMinutes = Math.floor(
      (trip.arrivalTime.getTime() - trip.departureTime.getTime()) / 60000
    );

    // TODO: Replace with real seat availability logic
    const seats = await this.getSeats(trip);

    return {
      tripId: trip.id,

      route: {
        routeId: trip.route.id,
        origin: trip.route.origin,
        destination: trip.route.destination,
        distanceKm: trip.route.distanceKm,
        estimatedMinutes: trip.route.estimatedMinutes,
      },

      operator: {
        operatorId: trip.bus.operator.id,
        name: trip.bus.operator.name,
        // rating: trip.bus.operator.rating ?? null,
        // logo: trip.bus.operator.logo ?? null,
      },

      bus: {
        busId: trip.bus.id,
        model: trip.bus.model,
        plateNumber: trip.bus.plateNumber,
        seatCapacity: trip.bus.seatCapacity,
        // busType: trip.bus.busType,
        amenities: trip.bus.amenities || [],
      },

      schedule: {
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        duration: durationMinutes,
      },

      pricing: {
        basePrice: trip.basePrice,
        serviceFee: 0,
        currency: 'VND',
      },

      availability: {
        totalSeats: seats.totalSeats,
        availableSeats: seats.availableSeats,
        occupancyRate: seats.occupancyRate,
      },

      // Trip does not have policies yet
      /*
      policies: trip.policies
        ? {
            cancellationPolicy: trip.policies.cancellationPolicy,
            modificationPolicy: trip.policies.modificationPolicy,
            refundPolicy: trip.policies.refundPolicy,
          }
        : null,
      */

      // Trip does not have pick-up and drop-off points yet
      /*
      pickupPoints: trip.pickupPoints.map((p) => ({
        pointId: p.id,
        name: p.name,
        address: p.address,
        time: p.time,
      })),

      dropoffPoints: trip.dropoffPoints.map((p) => ({
        pointId: p.id,
        name: p.name,
        address: p.address,
        time: p.time,
      })),
      */

      status: trip.status,
    };
  }
}
