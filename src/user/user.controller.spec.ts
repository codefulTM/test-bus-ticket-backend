import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../entities/booking.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('UserController', () => {
  let controller: UserController;
  let bookingService: BookingService;

  const mockBookingService = {
    findBookingsByUserWithDetails: jest.fn(),
  };

  const mockRequest = {
    user: {
      userId: 'test-user-id',
      email: 'test@example.com',
    },
  };

  const mockBookingData = [
    {
      id: 'booking-1',
      userId: 'test-user-id',
      tripId: 'trip-1',
      totalAmount: 500000,
      status: BookingStatus.PAID,
      bookedAt: new Date('2025-12-01T08:00:00Z'),
      cancelledAt: null,
      expiresAt: null,
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
      passengers: [
        {
          id: 'passenger-1',
          fullName: 'Nguyen Van A',
          documentId: '123456789',
          seatCode: 'A1',
        },
      ],
      seats: [
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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: BookingService,
          useValue: mockBookingService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    bookingService = module.get<BookingService>(BookingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserBookings', () => {
    it('should return all user bookings when no status filter is provided', async () => {
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue(mockBookingData);

      const result = await controller.getUserBookings(mockRequest);

      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'test-user-id',
        undefined,
      );
      expect(result).toEqual({
        success: true,
        message: 'User bookings retrieved successfully',
        data: mockBookingData,
      });
    });

    it('should return filtered user bookings when status filter is provided', async () => {
      const filteredBookings = mockBookingData.filter(b => b.status === BookingStatus.PAID);
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue(filteredBookings);

      const result = await controller.getUserBookings(mockRequest, BookingStatus.PAID);

      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'test-user-id',
        BookingStatus.PAID,
      );
      expect(result).toEqual({
        success: true,
        message: 'User bookings retrieved successfully',
        data: filteredBookings,
      });
    });

    it('should return pending bookings when status filter is pending', async () => {
      const pendingBooking = {
        ...mockBookingData[0],
        status: BookingStatus.PENDING,
        expiresAt: new Date('2025-12-01T08:15:00Z'),
      };
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue([pendingBooking]);

      const result = await controller.getUserBookings(mockRequest, BookingStatus.PENDING);

      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'test-user-id',
        BookingStatus.PENDING,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(BookingStatus.PENDING);
      expect(result.data[0].expiresAt).toBeDefined();
    });

    it('should return cancelled bookings when status filter is cancelled', async () => {
      const cancelledBooking = {
        ...mockBookingData[0],
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date('2025-12-01T09:00:00Z'),
      };
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue([cancelledBooking]);

      const result = await controller.getUserBookings(mockRequest, BookingStatus.CANCELLED);

      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'test-user-id',
        BookingStatus.CANCELLED,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(BookingStatus.CANCELLED);
      expect(result.data[0].cancelledAt).toBeDefined();
    });

    it('should return empty array when user has no bookings', async () => {
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue([]);

      const result = await controller.getUserBookings(mockRequest);

      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'test-user-id',
        undefined,
      );
      expect(result).toEqual({
        success: true,
        message: 'User bookings retrieved successfully',
        data: [],
      });
    });

    it('should handle service errors properly', async () => {
      const serviceError = new Error('Database connection failed');
      mockBookingService.findBookingsByUserWithDetails.mockRejectedValue(serviceError);

      await expect(controller.getUserBookings(mockRequest)).rejects.toThrow(serviceError);
      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'test-user-id',
        undefined,
      );
    });

    it('should extract userId from request object correctly', async () => {
      const customRequest = {
        user: {
          userId: 'different-user-id',
          email: 'different@example.com',
        },
      };
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue([]);

      await controller.getUserBookings(customRequest);

      expect(mockBookingService.findBookingsByUserWithDetails).toHaveBeenCalledWith(
        'different-user-id',
        undefined,
      );
    });

    it('should validate response structure includes all required fields', async () => {
      mockBookingService.findBookingsByUserWithDetails.mockResolvedValue(mockBookingData);

      const result = await controller.getUserBookings(mockRequest);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data.length > 0) {
        const booking = result.data[0];
        expect(booking).toHaveProperty('id');
        expect(booking).toHaveProperty('userId');
        expect(booking).toHaveProperty('tripId');
        expect(booking).toHaveProperty('totalAmount');
        expect(booking).toHaveProperty('status');
        expect(booking).toHaveProperty('bookedAt');
        expect(booking).toHaveProperty('trip');
        expect(booking).toHaveProperty('passengers');
        expect(booking).toHaveProperty('seats');

        // Validate trip details
        expect(booking.trip).toHaveProperty('route');
        expect(booking.trip).toHaveProperty('bus');
        
        // Validate passengers array
        expect(Array.isArray(booking.passengers)).toBe(true);
        
        // Validate seats array
        expect(Array.isArray(booking.seats)).toBe(true);
      }
    });
  });
});