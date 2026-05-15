import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

@Injectable()
export class ImagesRepository {
    constructor(
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>
    ) { }

    async create(data: typeof schema.images.$inferInsert) {
        return this.db.insert(schema.images).values(data).returning();
    }

    async findById(id: string) {
        return this.db.query.images.findFirst({
            where: eq(schema.images.id, id),
        });
    }

    async findByHash(hash: string) {
        return this.db.query.images.findFirst({
            where: eq(schema.images.hash, hash),
            columns: { hash: true },
        });
    }

    async update(id: string, data: Partial<typeof schema.images.$inferInsert>) {
        return this.db
            .update(schema.images)
            .set(data)
            .where(eq(schema.images.id, id))
            .returning();
    }

    async delete(id: string) {
        return this.db
            .delete(schema.images)
            .where(eq(schema.images.id, id))
            .returning();
    }
}
