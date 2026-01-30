import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ImageProcessor } from '../locations/processors/image-procesing.processor';
import { ImageStorageService } from './image-storage.service';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'image-processing', }),
  ],
  controllers: [ItemsController],
  providers: [ItemsService, ImageStorageService, ImageProcessor],
})
export class ItemsModule { }
