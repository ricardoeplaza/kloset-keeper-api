import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { LocationsService } from './locations.service';

import { CreateLocationDto } from './dto/create-location.dto';
import { MoveLocationDto } from './dto/move-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  findAll() {
    return this.locationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLocationDto: UpdateLocationDto) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }

  // Endpoint para mover contenedores (ej: Mover mochila a otra casa)
  @Patch(':id/move')
  moveLocation(
    @Param('id') id: string,
    @Body() moveLocationDto: MoveLocationDto,
  ) {
    return this.locationsService.moveLocation(id, moveLocationDto.destinationParentId);
  }

  // Endpoint para mover contenedores (ej: Mover mochila a otra casa)
  @Get(':id/path')
  breadCrumbLocation(
    @Param('id') id: string
  ) {
    return this.locationsService.getFullPath(id);
  }
}
