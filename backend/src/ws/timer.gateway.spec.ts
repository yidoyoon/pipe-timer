import { Test } from '@nestjs/testing';

import { RedisAuthService } from '@/redis/redis-auth.service';
import { RedisTimerSocketService } from '@/redis/redis-timer-socket.service';
import { TimerGateway } from '@/ws/timer.gateway';

describe('TimerGateway', () => {
  let timerGateway: TimerGateway;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TimerGateway,
        { provide: RedisAuthService, useValue: { verify: jest.fn() } },
        { provide: RedisTimerSocketService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    timerGateway = moduleRef.get<TimerGateway>(TimerGateway);
  });

  it('should be defined', () => {
    expect(timerGateway).toBeDefined();
  });
});
