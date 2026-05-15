import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ImagesModule } from '../images/images.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

import { EmbeddingProcessor } from './processors/generate-embedding.processor';
import { ItemsSearchService } from './items-search.service';
import { ItemProcessingGateway } from './gateways/item-processing.gateway';
import { ItemsRepository } from './repositories/items.repository';

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
    JwtModule,
    ImagesModule,
  ],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository, EmbeddingProcessor, ItemsSearchService, ItemProcessingGateway],
})
export class ItemsModule { }

