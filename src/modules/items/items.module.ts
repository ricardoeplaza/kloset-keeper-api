import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ImageStorageService } from './image-storage.service';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

import { EmbeddingProcessor } from './processors/items-procesing.processor';
import { ImageProcessor } from './processors/image-procesing.processor';

@Module({
  imports: [
    BullModule.registerFlowProducer({ name: 'item-processing', }),
    BullModule.registerQueue({ name: 'image-processing', }),
    BullModule.registerQueue({ name: 'item-embedding', }),
  ],
  controllers: [ItemsController],
  providers: [ItemsService, ImageStorageService, ImageProcessor, EmbeddingProcessor],
})
export class ItemsModule { }
