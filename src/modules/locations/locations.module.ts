import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { LocationsRepository } from './repositories/locations.repository';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, LocationsRepository],
})
export class LocationsModule {}

