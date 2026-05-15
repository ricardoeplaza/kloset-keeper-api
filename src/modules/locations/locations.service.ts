import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { RequestContext } from 'src/infra/context/request-context';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsRepository } from './repositories/locations.repository';

@Injectable()
export class LocationsService {
  constructor(
    private readonly locationsRepository: LocationsRepository
  ) { }

  async create(location: CreateLocationDto) {
    const userId = RequestContext.getRequiredUserId();
    const [newLocation] = await this.locationsRepository.create({
      ...location,
      id: uuidv7(),
      ownerId: userId,
    });
    return newLocation;
  }

  async findAll() {
    const userId = RequestContext.getRequiredUserId();
    return this.locationsRepository.findAllByOwner(userId);
  }

  async findOne(id: string) {
    const userId = RequestContext.getRequiredUserId();
    const result = await this.locationsRepository.findByIdAndOwner(id, userId);

    if (!result) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return result;
  }

  async update(id: string, updateLocationDto: UpdateLocationDto) {
    const userId = RequestContext.getRequiredUserId();

    const location = await this.findOne(id);

    const { parentId } = updateLocationDto;

    if (parentId !== undefined && parentId !== location.parentId) {
      await this.validateHierarchy(id, parentId, userId);
    }

    const [updated] = await this.locationsRepository.updateByOwner(id, userId, updateLocationDto);

    return updated;
  }

  async remove(id: string) {
    const userId = RequestContext.getRequiredUserId();

    const [deleted] = await this.locationsRepository.deleteByOwner(id, userId);

    if (!deleted) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }
    return deleted;
  }

  async moveLocation(id: string, newParentId: string | null) {
    return this.update(id, { parentId: newParentId });
  }

  async getFullPath(locationId: string) {
    const userId = RequestContext.getRequiredUserId();

    await this.findOne(locationId);

    return this.locationsRepository.getFullPath(locationId, userId);
  }

  private async validateHierarchy(id: string, parentId: string | null, userId: string) {
    if (parentId === null) return;

    if (id === parentId) {
      throw new BadRequestException('A location cannot be its own parent');
    }

    const targetParent = await this.locationsRepository.findByIdAndOwner(parentId, userId);

    if (!targetParent) {
      throw new NotFoundException(`Target parent location not found or access denied`);
    }

    if (await this.locationsRepository.checkIsDescendant(id, parentId)) {
      throw new BadRequestException('Invalid hierarchy: target parent is a descendant');
    }
  }
}
