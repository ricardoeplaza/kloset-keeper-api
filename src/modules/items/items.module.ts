import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

import { EmbeddingProcessor } from './processors/generate-embedding.processor';
import { ImagesStorageService } from '../images/images-storage.service';

@Module({
  imports: [
    BullModule.registerFlowProducer({ name: 'item-processing-flow', }),
    BullModule.registerQueue({ name: 'remove-background', }),
    BullModule.registerQueue({ name: 'extract-colors', }),
    BullModule.registerQueue({ name: 'generate-embedding', }),
  ],
  controllers: [ItemsController],
  providers: [ItemsService, EmbeddingProcessor, ImagesStorageService],
})
export class ItemsModule { }
