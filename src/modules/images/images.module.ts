import { Module } from '@nestjs/common';

import { ImagesColorsService } from './images-colors.service';
import { ImagesColorsProcessor } from './processors/extract-color.processor';
import { ImageProcessor } from './processors/remove-background.processor';
import { ImagesController } from './images.controller';
import { ImagesStorageService } from './images-storage.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesColorsService, ImageProcessor, ImagesColorsProcessor, ImagesStorageService],
})
export class ImagesModule {}
