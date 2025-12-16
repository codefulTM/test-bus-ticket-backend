import { Test, TestingModule } from '@nestjs/testing';
import { SeatStatusService } from './seat-status.service';

describe('SeatStatusService', () => {
  let service: SeatStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeatStatusService],
    }).compile();

    service = module.get<SeatStatusService>(SeatStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
