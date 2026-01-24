import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';

import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import * as schema from './schemas/location.schema';


@Injectable()
export class LocationsService {
  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>
  ) { }

  async create(location: CreateLocationDto) {
    const [newLocation] = await this.db
      .insert(schema.locations)
      .values({ id: uuidv7(), ...location })
      .returning();
    return newLocation;
  }

  async findAll() {
    return await this.db.query.locations.findMany();
  }

  async findOne(id: string) {
    const [result] = await this.db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.id, id));

    if (!result) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }
    return result;
  }

  async update(id: string, updateLocationDto: UpdateLocationDto) {
    // Check if the location exists first
    await this.findOne(id);

    const { parentId } = updateLocationDto;

    if (parentId) {
      // 1. Cannot be its own parent
      if (id === parentId) {
        throw new BadRequestException('A location cannot be its own parent');
      }

      // 2. Validate target parent exists
      const targetParent = await this.db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, parentId));

      if (targetParent.length === 0) {
        throw new NotFoundException(`Target parent location with ID ${parentId} not found`);
      }

      // 3. New parent cannot be a descendant (prevent cycles)
      const isRecursive = await this.checkIsDescendant(id, parentId);
      if (isRecursive) {
        throw new BadRequestException('Invalid hierarchy: target parent is a descendant');
      }
    }

    const [updated] = await this.db
      .update(schema.locations)
      .set(updateLocationDto)
      .where(eq(schema.locations.id, id))
      .returning();

    return updated;
  }

  async remove(id: string) {
    const [deleted] = await this.db
      .delete(schema.locations)
      .where(eq(schema.locations.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }
    return deleted;
  }

  private async checkIsDescendant(ancestorId: string, potentialDescendantId: string): Promise<boolean> {
    const query = sql`
      WITH RECURSIVE parent_search AS (
        SELECT parent_id 
        FROM ${schema.locations} 
        WHERE id = ${potentialDescendantId}
        
        UNION ALL
        
        SELECT l.parent_id
        FROM ${schema.locations} l
        INNER JOIN parent_search ps ON l.id = ps.parent_id
        WHERE ps.parent_id IS NOT NULL
      )
      SELECT EXISTS (
        SELECT 1 FROM parent_search WHERE parent_id = ${ancestorId}
      ) as "isDescendant"
    `;

    const result = await this.db.execute(query);
    return !!result.rows[0]?.isDescendant;
  }

  async moveLocation(locationId: string, newParentId: string | null) {
    // 1. Validate node existence (already throws NotFoundException)
    await this.findOne(locationId);

    // 2. Moving to root
    if (newParentId === null) {
      const [updated] = await this.db
        .update(schema.locations)
        .set({ parentId: null })
        .where(eq(schema.locations.id, locationId))
        .returning();
      return updated;
    }

    // 3. Prevent moving to itself
    if (locationId === newParentId) {
      throw new BadRequestException('A location cannot be moved inside itself');
    }

    // 4. Validate new parent existence
    await this.findOne(newParentId);

    // 5. Prevent cycles
    const isDescendant = await this.checkIsDescendant(locationId, newParentId);
    if (isDescendant) {
      throw new BadRequestException('Invalid move: Target is a descendant of the current location');
    }

    const [updated] = await this.db
      .update(schema.locations)
      .set({ parentId: newParentId })
      .where(eq(schema.locations.id, locationId))
      .returning();

    return updated;
  }

  async getFullPath(locationId: string) {
    // Verify existence first
    await this.findOne(locationId);

    const query = sql`
      WITH RECURSIVE location_path AS (
        SELECT id, name, parent_id, 1 as level
        FROM ${schema.locations}
        WHERE id = ${locationId}
        
        UNION ALL
        
        SELECT l.id, l.name, l.parent_id, lp.level + 1
        FROM ${schema.locations} l
        INNER JOIN location_path lp ON l.id = lp.parent_id
      )
      SELECT * FROM location_path ORDER BY level DESC
    `;

    const result = await this.db.execute(query);

    return result.rows as Array<{
      id: string;
      name: string;
      parent_id: string | null;
      level: number;
    }>;
  }
}