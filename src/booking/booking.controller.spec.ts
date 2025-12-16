import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('BookingController', () => {
  let controller: BookingController;
  let service: BookingService;

  const mockBookingService = {
    createBooking: jest.fn(),
    findBookingById: jest.fn(),
    findBookingsByUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        {
          provide: BookingService,
          useValue: mockBookingService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<BookingController>(BookingController);
    service = module.get<BookingService>(BookingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBooking', () => {
    it('should create a booking successfully', async () => {
      const createBookingDto = {
        tripId: 'trip-123',
        seats: [
          {
            id: 'seat-1',
            code: '1A',
            type: 'normal' as const,
            price: 150000,
          },
        ],
        passengers: [
          {
            fullName: 'John Doe',
            documentId: '123456789',
            seatCode: '1A',
          },
        ],
        totalPrice: 150000,
      };

      const mockResponse = {
        id: 'booking-123',
        tripId: 'trip-123',
        totalAmount: 150000,
        status: 'pending' as any,
        bookedAt: new Date(),
        expirationTimestamp: new Date(),
        passengers: [],
        seats: [],
      };

      const mockRequest = { user: { userId: 'user-123' } };

      mockBookingService.createBooking.mockResolvedValue(mockResponse);

      const result = await controller.createBooking(mockRequest, createBookingDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Booking created successfully');
      expect(result.data).toEqual(mockResponse);
      expect(service.createBooking).toHaveBeenCalledWith('user-123', createBookingDto);
    });
  });
});