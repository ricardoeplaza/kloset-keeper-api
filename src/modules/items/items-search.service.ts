import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { and, eq, l2Distance, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import FormData from 'form-data';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';
import { SearchItemsDto } from './dto/search-items.dto';

@Injectable()
export class ItemsSearchService {
    constructor(
        @Inject(DRIZZLE) private readonly _db: NodePgDatabase<typeof schema>,
        private readonly configService: ConfigService
    ) { }

    /**
     * Performs an advanced search combining SQL filters, JSONB palette matching, and vector similarity.
     */
    async search(dto: SearchItemsDto) {
        const {
            query, brand, category, locationId,
            colorGroup, materials, embedding,
            limit = 20, offset = 0 // Default values to avoid undefined type errors
        } = dto;

        // Explicitly typing the array as SQL[] to avoid 'never' type errors
        const filters: SQL[] = [];

        // 1. Metadata filters
        if (brand) filters.push(eq(schema.items.brand, brand));
        if (category) filters.push(eq(schema.items.category, category));
        if (locationId) filters.push(eq(schema.items.locationId, locationId));

        let searchEmbedding: number[] | null = null;

        // 2. Full-text search (Simple ILIKE implementation)
        if (query) {
            searchEmbedding = await this.generateTextEmbedding(query);

            // We still keep the ILIKE filter as a fallback/reinforcement
            filters.push(
                sql`(${schema.items.name} ILIKE ${'%' + query + '%'} OR ${schema.items.notes} ILIKE ${'%' + query + '%'})`
            );
        }

        // 3. JSONB Color Filter
        // Checks if the color_palette array contains an object with the requested group
        if (colorGroup) {
            const jsonTarget = JSON.stringify([{ group: colorGroup }]);
            filters.push(sql`${schema.items.color_palette} @> ${jsonTarget}::jsonb`);
        }

        // 4. Postgres Array Filter (Materials)
        if (materials && materials.length > 0) {
            filters.push(sql`${schema.items.material} && ${materials}::text[]`);
        }

        // 5. Dynamic Sorting: Vector Similarity vs Recency
        let orderBy: SQL = sql`${schema.items.createdAt} DESC`;
        if (embedding) {
            orderBy = l2Distance(schema.items.embedding, embedding);
        }

        return await this._db
            .select()
            .from(schema.items)
            .leftJoin(schema.images, eq(schema.items.imageId, schema.images.id))
            .where(filters.length > 0 ? and(...filters) : undefined)
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);
    }

    /**
     * Finding similar items based on vector distance (K-Nearest Neighbors).
     */
    async findSimilar(itemId: string, limit: number = 5) {
        // Retrieve the embedding of the source item first
        const [sourceItem] = await this._db
            .select({ embedding: schema.items.embedding })
            .from(schema.items)
            .where(eq(schema.items.id, itemId))
            .limit(1);

        if (!sourceItem?.embedding) return [];

        return await this._db
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
            .orderBy(l2Distance(schema.items.embedding, sourceItem.embedding))
            .limit(limit);
    }

    /**
     * Generates faceted search data for the UI filters.
     */
    async getSearchFacets() {
        // Parallel execution for better performance in a Homelab environment
        const [categoryCounts, brandCounts, colorCounts] = await Promise.all([
            this._db
                .select({ name: schema.items.category, count: sql<number>`count(*)` })
                .from(schema.items)
                .groupBy(schema.items.category),

            this._db
                .select({ name: schema.items.brand, count: sql<number>`count(*)` })
                .from(schema.items)
                .groupBy(schema.items.brand),

            // Advanced JSONB Aggregation
            this._db.execute(sql`
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

    /**
   * Internal helper to communicate with the FastAPI AI Worker
   */
    private async generateTextEmbedding(text: string): Promise<number[] | null> {
        try {
            const form = new FormData();
            form.append('text', text);

            const baseURL = this.configService.get<string>('IA_WORKER_BASE_URL');

            const { data } = await axios.post(
                `${baseURL}/embeddings/text`,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 10000,
                }
            );

            // Assuming your worker returns { embedding: [0.1, 0.2, ...] }
            return data.embedding;
        } catch (error) {
            console.error('Error generating embedding:', error.message);
            // We return null so the search continues with traditional SQL filters only
            return null;
        }
    }
}