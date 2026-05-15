import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

@Injectable()
export class SystemRepository {
    constructor(
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>
    ) { }

    async findAllCategories() {
        return this.db.query.categories.findMany();
    }

    async findCategoryByName(name: string) {
        return this.db.query.categories.findFirst({
            where: eq(schema.categories.name, name),
        });
    }

    async createCategory(data: typeof schema.categories.$inferInsert) {
        return this.db
            .insert(schema.categories)
            .values(data)
            .returning();
    }
}
