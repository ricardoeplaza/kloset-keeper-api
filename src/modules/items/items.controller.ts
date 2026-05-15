import { BadRequestException, Body, Controller, Delete, FileTypeValidator, Get, MaxFileSizeValidator, Param, ParseFilePipe, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CreateItemDto } from './dto/create-item.dto';
import { SearchItemsDto } from './dto/search-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemsSearchService } from './items-search.service';
import { ItemsService } from './items.service';

/**
 * Constants for file validation to improve readability
 */
const MAX_FILE_SIZE = 1024 * 1024 * 15; // 15MB
const ALLOWED_FILE_TYPES = /.(png|jpeg|jpg|webp)/;

@Controller('items')
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly itemsSearchService: ItemsSearchService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createItemDto: CreateItemDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.itemsService.create(createItemDto, file);
  }

  @Get()
  async findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateItemDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.itemsService.update(id, updateItemDto, file);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.remove(id);
  }

  @Post('search')
  async advancedSearch(@Body() searchDto: SearchItemsDto) {
    return this.itemsSearchService.search(searchDto);
  }

  @Get('facets')
  async getFacets() {
    return this.itemsSearchService.getSearchFacets();
  }

  @Get(':id/similar')
  async getSimilarItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit: number = 5,
  ) {
    return this.itemsSearchService.findSimilar(id, limit);
  }

  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadBulk(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.itemsService.createBulk(files);
  }
}
