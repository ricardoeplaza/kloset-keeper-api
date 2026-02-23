import { Test, TestingModule } from '@nestjs/testing';
import { SystemSetupService } from './system-setup.service';

describe('SystemService', () => {
  let service: SystemSetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemSetupService],
    }).compile();

    service = module.get<SystemSetupService>(SystemSetupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
