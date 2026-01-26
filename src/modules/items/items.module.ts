import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { ImageStorageService } from './image-storage.service';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService, ImageStorageService],
})
export class ItemsModule {}
