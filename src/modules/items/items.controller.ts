import { Controller, Get, Post, Body, Patch, Param, Delete, FileTypeValidator, MaxFileSizeValidator, ParseFilePipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) { }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 15 }), // 15MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ]
      })
    ) file: Express.Multer.File,
    @Body() createItemDto: CreateItemDto,
  ) {
    return this.itemsService.create(createItemDto, file);
  }

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 15 }), // 15MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ]
      })) image: Express.Multer.File,
  ) {
    return this.itemsService.update(id, updateItemDto, image);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemsService.remove(id);
  }
}
