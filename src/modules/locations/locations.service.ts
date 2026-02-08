import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';

import { DRIZZLE } from 'src/db/drizzle.module';
import { RequestContext } from 'src/infra/context/request-context';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import * as schema from './schemas/location.schema';

@Injectable()
export class LocationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>
  ) { }

  async create(location: CreateLocationDto) {
    const userId = RequestContext.getRequiredUserId();
    const [newLocation] = await this.db
      .insert(schema.locations)
      .values({
        ...location,
        id: uuidv7(),
        ownerId: userId,
      })
      .returning();
    return newLocation;
  }

  async findAll() {
    const userId = RequestContext.getRequiredUserId();
    return this.db.query.locations.findMany({
      where: eq(schema.locations.ownerId, userId),
    });
  }

  async findOne(id: string) {
    const userId = RequestContext.getRequiredUserId();
    const result = await this.db.query.locations.findFirst({
      where: and(
        eq(schema.locations.id, id),
        eq(schema.locations.ownerId, userId)
      ),
    });

    if (!result) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return result;
  }

  async update(id: string, updateLocationDto: UpdateLocationDto) {
    const userId = RequestContext.getRequiredUserId();

    // 1. Verificar existencia y propiedad
    const location = await this.findOne(id);

    const { parentId } = updateLocationDto;

    // 2. Validación jerárquica solo si cambia el parentId
    if (parentId !== undefined && parentId !== location.parentId) {
      await this.validateHierarchy(id, parentId, userId);
    }

    // 3. Ejecutar actualización
    const [updated] = await this.db
      .update(schema.locations)
      .set(updateLocationDto)
      .where(
        and(
          eq(schema.locations.id, id),
          eq(schema.locations.ownerId, userId)
        )
      )
      .returning();

    return updated;
  }

  async remove(id: string) {
    const userId = RequestContext.getRequiredUserId();

    const [deleted] = await this.db
      .delete(schema.locations)
      .where(
        and(
          eq(schema.locations.id, id),
          eq(schema.locations.ownerId, userId)
        )
      )
      .returning();

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

    // CTE recursiva para obtener la ruta hacia la raíz
    const query = sql`
      WITH RECURSIVE location_path AS (
        SELECT id, name, parent_id, 1 as level
        FROM ${schema.locations}
        WHERE id = ${locationId} AND owner_id = ${userId}
        
        UNION ALL
        
        SELECT l.id, l.name, l.parent_id, lp.level + 1
        FROM ${schema.locations} l
        INNER JOIN location_path lp ON l.id = lp.parent_id
      )
      SELECT id, name, parent_id as "parentId", level 
      FROM location_path 
      ORDER BY level DESC
    `;

    const result = await this.db.execute(query);
    return result.rows;
  }

  private async checkIsDescendant(ancestorId: string, potentialDescendantId: string): Promise<boolean> {
    // Optimización: Buscamos si el ancestorId aparece en la línea ascendente del potencial descendiente
    const query = sql`
      WITH RECURSIVE branch AS (
        SELECT id, parent_id 
        FROM ${schema.locations} 
        WHERE id = ${potentialDescendantId}
        
        UNION ALL
        
        SELECT l.id, l.parent_id
        FROM ${schema.locations} l
        INNER JOIN branch b ON l.id = b.parent_id
      )
      SELECT EXISTS (
        SELECT 1 FROM branch WHERE id = ${ancestorId}
      ) as "isDescendant"
    `;

    const result = await this.db.execute(query);
    // En node-postgres el booleano viene directamente en rows[0]
    return Boolean(result.rows[0]?.isDescendant);
  }

  private async validateHierarchy(id: string, parentId: string | null, userId: string) {
    if (parentId === null) return;

    if (id === parentId) {
      throw new BadRequestException('A location cannot be its own parent');
    }

    // Usamos la Query API para verificar el padre: más eficiente
    const targetParent = await this.db.query.locations.findFirst({
      columns: { id: true },
      where: and(
        eq(schema.locations.id, parentId),
        eq(schema.locations.ownerId, userId)
      ),
    });

    if (!targetParent) {
      throw new NotFoundException(`Target parent location not found or access denied`);
    }

    if (await this.checkIsDescendant(id, parentId)) {
      throw new BadRequestException('Invalid hierarchy: target parent is a descendant');
    }
  }
}