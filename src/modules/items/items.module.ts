import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

import { EmbeddingProcessor } from './processors/generate-embedding.processor';
import { ImagesStorageService } from '../images/images-storage.service';
import { ItemsSearchService } from './items-search.service';

/**
 * BullMQ Queues Configuration
 * 
 * NOTE: Job Cleanup is handled at the factory level (see item-jobs.factory.ts).
 * Each queue here will automatically purge old completed/failed jobs based on
 * the retention strategy defined in the factory.
 * 
 * MONITORING: Consider adding @nestjs/bullmq's built-in dashboard or
 * external tools like Bull Board for visual queue monitoring.
 */
@Module({
  imports: [
    BullModule.registerFlowProducer({ name: 'item-processing-flow', }),
    BullModule.registerQueue({ name: 'remove-background', }),
    BullModule.registerQueue({ name: 'extract-colors', }),
    BullModule.registerQueue({ name: 'generate-embedding', }),
  ],
  controllers: [ItemsController],
  providers: [ItemsService, EmbeddingProcessor, ImagesStorageService, ItemsSearchService],
})
export class ItemsModule { }
