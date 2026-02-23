import { Test, TestingModule } from '@nestjs/testing';
import { SystemCategoriesService } from './system-categories.service';

describe('SystemService', () => {
  let service: SystemCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemCategoriesService],
    }).compile();

    service = module.get<SystemCategoriesService>(SystemCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
