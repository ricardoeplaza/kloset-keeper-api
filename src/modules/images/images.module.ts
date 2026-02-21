import { Module } from '@nestjs/common';

import { ImagesColorsService } from './images-colors.service';
import { ImagesColorsProcessor } from './processors/extract-color.processor';
import { ImageProcessor } from './processors/remove-background.processor';

@Module({
  controllers: [],
  providers: [ImagesColorsService, ImageProcessor, ImagesColorsProcessor],
})
export class ImagesModule {}
