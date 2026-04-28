import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ImagesStorageService } from './images-storage.service';

/**
 * Controller to expose system-wide configuration and initialization status.
 */
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesStorageService: ImagesStorageService) { }

  @Get(':id')
  async getImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.imagesStorageService.getImage(id);
  }

  @Get(':id/thumb')
  async getImageThumb(@Param('id', ParseUUIDPipe) id: string) {
    return this.imagesStorageService.getImageThumb(id);
  }

}