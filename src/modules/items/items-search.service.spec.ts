import { Test, TestingModule } from '@nestjs/testing';
import { ItemsSearchService } from './items-search.service';

describe('ItemsSearchService', () => {
  let service: ItemsSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemsSearchService],
    }).compile();

    service = module.get<ItemsSearchService>(ItemsSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
