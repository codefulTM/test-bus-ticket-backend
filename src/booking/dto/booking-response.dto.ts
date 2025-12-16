import { BookingStatus } from '../../entities/booking.entity';

export class BookingResponseDto {
  id: string;
  tripId: string;
  totalAmount: number;
  status: BookingStatus;
  bookedAt: Date;
  expirationTimestamp: Date | null;
  passengers: {
    id: string;
    fullName: string;
    documentId: string;
    seatCode: string;
  }[];
  seats: {
    seatId: string;
    seatCode: string;
    status: string;
  }[];
}