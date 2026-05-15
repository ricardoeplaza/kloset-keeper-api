import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';
import { SearchItemsDto } from '../dto/search-items.dto';

@Injectable()
export class ItemsRepository {
    constructor(
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>
    ) { }

    async create(data: typeof schema.items.$inferInsert) {
        return this.db.insert(schema.items).values(data).returning();
    }

    async findById(id: string) {
        return this.db.query.items.findFirst({
            where: eq(schema.items.id, id),
        });
    }

    async findByIdWithOwner(id: string, ownerId: string) {
        return this.db.query.items.findFirst({
            where: and(
                eq(schema.items.id, id),
                eq(schema.items.ownerId, ownerId)
            ),
        });
    }

    async findAllByOwner(ownerId: string) {
        return this.db
            .select()
            .from(schema.items)
            .leftJoin(schema.images, eq(schema.items.imageId, schema.images.id))
            .where(eq(schema.items.ownerId, ownerId));
    }

    async update(id: string, data: Partial<typeof schema.items.$inferInsert>) {
        return this.db
            .update(schema.items)
            .set(data)
            .where(eq(schema.items.id, id))
            .returning();
    }

    async updateByOwner(id: string, ownerId: string, data: Partial<typeof schema.items.$inferInsert>) {
        return this.db
            .update(schema.items)
            .set(data)
            .where(
                and(
                    eq(schema.items.id, id),
                    eq(schema.items.ownerId, ownerId)
                )
            )
            .returning();
    }

    async delete(id: string) {
        return this.db
            .delete(schema.items)
            .where(eq(schema.items.id, id))
            .returning();
    }

    async deleteByOwner(id: string, ownerId: string) {
        return this.db
            .delete(schema.items)
            .where(
                and(
                    eq(schema.items.id, id),
                    eq(schema.items.ownerId, ownerId)
                )
            )
            .returning();
    }

    async search(dto: SearchItemsDto, searchEmbedding: number[] | null) {
        const {
            query, brand, category, locationId,
            colorGroup, materials, embedding,
            limit = 20, offset = 0
        } = dto;

        const filters: SQL[] = [];

        if (brand) filters.push(eq(schema.items.brand, brand));
        if (category) filters.push(eq(schema.items.category, category));
        if (locationId) filters.push(eq(schema.items.locationId, locationId));

        if (query) {
            filters.push(
                sql`(${schema.items.name} ILIKE ${'%' + query + '%'} OR ${schema.items.notes} ILIKE ${'%' + query + '%'})`
            );
        }

        if (colorGroup) {
            const jsonTarget = JSON.stringify([{ group: colorGroup }]);
            filters.push(sql`${schema.items.color_palette} @> ${jsonTarget}::jsonb`);
        }

        if (materials && materials.length > 0) {
            filters.push(sql`${schema.items.material} && ${materials}::text[]`);
        }

        let orderBy: SQL = sql`${schema.items.createdAt} DESC`;
        if (embedding) {
            orderBy = sql`${schema.items.embedding} <-> ${JSON.stringify(embedding)}`;
        }

        return this.db
            .select()
            .from(schema.items)
            .leftJoin(schema.images, eq(schema.items.imageId, schema.images.id))
            .where(filters.length > 0 ? and(...filters) : undefined)
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);
    }

    async findSimilar(itemId: string, embedding: number[], limit: number) {
        return this.db
            .select({
                id: schema.items.id,
                name: schema.items.name,
                brand: schema.items.brand,
                category: schema.items.category,
                size: schema.items.size,
                colorPalette: schema.items.color_palette,
                material: schema.items.material,
                imageId: schema.items.imageId,
                locationId: schema.items.locationId,
                createdAt: schema.items.createdAt,
            })
            .from(schema.items)
            .leftJoin(schema.images, eq(schema.items.imageId, schema.images.id))
            .where(sql`${schema.items.id} != ${itemId}`)
            .orderBy(sql`${schema.items.embedding} <-> ${JSON.stringify(embedding)}`)
            .limit(limit);
    }

    async getEmbeddingById(itemId: string) {
        const result = await this.db
            .select({ embedding: schema.items.embedding })
            .from(schema.items)
            .where(eq(schema.items.id, itemId))
            .limit(1);
        return result[0];
    }

    async getSearchFacets() {
        const [categoryCounts, brandCounts, colorCounts] = await Promise.all([
            this.db
                .select({ name: schema.items.category, count: sql<number>`count(*)` })
                .from(schema.items)
                .groupBy(schema.items.category),

            this.db
                .select({ name: schema.items.brand, count: sql<number>`count(*)` })
                .from(schema.items)
                .groupBy(schema.items.brand),

            this.db.execute(sql`
                SELECT 
                    color->>'group' as color_group, 
                    count(*) as count
                FROM items, 
                    jsonb_array_elements(color_palette) as color
                GROUP BY color_group
                ORDER BY count DESC
            `)
        ]);

        return {
            categories: categoryCounts,
            brands: brandCounts,
            colors: colorCounts.rows,
        };
    }
}
