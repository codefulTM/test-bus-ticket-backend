import { Test, TestingModule } from '@nestjs/testing';
import { SeatStatusController } from './seat-status.controller';

describe('SeatStatusController', () => {
  let controller: SeatStatusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatStatusController],
    }).compile();

    controller = module.get<SeatStatusController>(SeatStatusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
