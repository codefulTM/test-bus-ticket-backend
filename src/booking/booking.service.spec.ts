import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { BookingService } from './booking.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { PassengerDetail } from '../entities/passenger-detail.entity';
import { SeatStatus } from '../entities/seat-status.entity';
import { Trip } from '../entities/trip.entity';
import { Seat } from '../entities/seat.entity';
import { AuditLog } from '../entities/audit-log.entity';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepository: Repository<Booking>;
  let mockQueryBuilder: Partial<SelectQueryBuilder<Booking>>;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockBookingData = [
    {
      id: 'booking-1',
      userId: 'user-1',
      tripId: 'trip-1',
      totalAmount: 500000,
      status: BookingStatus.PAID,
      bookedAt: new Date('2025-12-01T08:00:00Z'),
      cancelledAt: null,
      trip: {
        id: 'trip-1',
        departureTime: new Date('2025-12-07T08:00:00Z'),
        arrivalTime: new Date('2025-12-07T18:00:00Z'),
        basePrice: 450000,
        status: 'scheduled',
        route: {
          id: 'route-1',
          name: 'Hanoi - Ho Chi Minh City',
          description: 'Express route',
          origin: 'Hanoi',
          destination: 'Ho Chi Minh City',
          distanceKm: 1700,
          estimatedMinutes: 600,
        },
        bus: {
          id: 'bus-1',
          plateNumber: '30A-12345',
          model: 'Hyundai Universe',
          seatCapacity: 45,
        },
      },
      passengerDetails: [
        {
          id: 'passenger-1',
          fullName: 'Nguyen Van A',
          documentId: '123456789',
          seatCode: 'A1',
        },
      ],
      seatStatuses: [
        {
          id: 'seat-status-1',
          seatId: 'seat-1',
          state: 'booked',
          lockedUntil: null,
          seat: {
            id: 'seat-1',
            seatCode: 'A1',
            seatType: 'vip',
            isActive: true,
          },
        },
      ],
    },
  ];

  beforeEach(async () => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: getRepositoryToken(Booking),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(PassengerDetail),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(SeatStatus),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Seat),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    bookingRepository = module.get<Repository<Booking>>(getRepositoryToken(Booking));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBookingsByUserWithDetails', () => {
    it('should return user bookings with all details when no status filter', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockBookingData);

      const result = await service.findBookingsByUserWithDetails('user-1');

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('booking');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('booking.trip', 'trip');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('trip.route', 'route');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('trip.bus', 'bus');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('booking.passengerDetails', 'passengerDetails');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('booking.seatStatuses', 'seatStatuses');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('seatStatuses.seat', 'seat');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('booking.userId = :userId', { userId: 'user-1' });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('booking.bookedAt', 'DESC');
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('booking-1');
      expect(result[0].trip).toBeDefined();
      expect(result[0].passengers).toHaveLength(1);
      expect(result[0].seats).toHaveLength(1);
    });

    it('should apply status filter when provided', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockBookingData);

      await service.findBookingsByUserWithDetails('user-1', BookingStatus.PAID);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('booking.status = :status', { status: BookingStatus.PAID });
    });

    it('should calculate expiration time for pending bookings', async () => {
      const pendingBooking = {
        ...mockBookingData[0],
        status: BookingStatus.PENDING,
        bookedAt: new Date('2025-12-01T08:00:00Z'),
      };
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([pendingBooking]);

      const result = await service.findBookingsByUserWithDetails('user-1');

      expect(result[0].expiresAt).toEqual(new Date('2025-12-01T08:15:00Z'));
    });

    it('should handle bookings with null trip data', async () => {
      const bookingWithoutTrip = {
        ...mockBookingData[0],
        trip: null,
      };
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([bookingWithoutTrip]);

      const result = await service.findBookingsByUserWithDetails('user-1');

      expect(result[0].trip).toBeNull();
    });

    it('should return empty array when user has no bookings', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findBookingsByUserWithDetails('user-1');

      expect(result).toEqual([]);
    });

    it('should transform route data correctly', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockBookingData);

      const result = await service.findBookingsByUserWithDetails('user-1');

      const route = result[0].trip?.route;
      expect(route).toBeDefined();
      expect(route?.name).toBe('Hanoi - Ho Chi Minh City');
      expect(route?.origin).toBe('Hanoi');
      expect(route?.destination).toBe('Ho Chi Minh City');
    });

    it('should transform passenger data correctly', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockBookingData);

      const result = await service.findBookingsByUserWithDetails('user-1');

      const passengers = result[0].passengers;
      expect(passengers).toHaveLength(1);
      expect(passengers[0].fullName).toBe('Nguyen Van A');
      expect(passengers[0].seatCode).toBe('A1');
    });
  });
});