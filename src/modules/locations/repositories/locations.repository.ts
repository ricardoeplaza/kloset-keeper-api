import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

@Injectable()
export class LocationsRepository {
    constructor(
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>
    ) { }

    async create(data: typeof schema.locations.$inferInsert) {
        return this.db.insert(schema.locations).values(data).returning();
    }

    async findById(id: string) {
        return this.db.query.locations.findFirst({
            where: eq(schema.locations.id, id),
        });
    }

    async findByIdAndOwner(id: string, ownerId: string) {
        return this.db.query.locations.findFirst({
            where: and(
                eq(schema.locations.id, id),
                eq(schema.locations.ownerId, ownerId)
            ),
        });
    }

    async findAllByOwner(ownerId: string) {
        return this.db.query.locations.findMany({
            where: eq(schema.locations.ownerId, ownerId),
        });
    }

    async update(id: string, data: Partial<typeof schema.locations.$inferInsert>) {
        return this.db
            .update(schema.locations)
            .set(data)
            .where(eq(schema.locations.id, id))
            .returning();
    }

    async updateByOwner(id: string, ownerId: string, data: Partial<typeof schema.locations.$inferInsert>) {
        return this.db
            .update(schema.locations)
            .set(data)
            .where(
                and(
                    eq(schema.locations.id, id),
                    eq(schema.locations.ownerId, ownerId)
                )
            )
            .returning();
    }

    async deleteByOwner(id: string, ownerId: string) {
        return this.db
            .delete(schema.locations)
            .where(
                and(
                    eq(schema.locations.id, id),
                    eq(schema.locations.ownerId, ownerId)
                )
            )
            .returning();
    }

    async checkIsDescendant(ancestorId: string, potentialDescendantId: string): Promise<boolean> {
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
        return Boolean(result.rows[0]?.isDescendant);
    }

    async getFullPath(locationId: string, userId: string) {
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
}
