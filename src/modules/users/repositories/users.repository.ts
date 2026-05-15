import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

@Injectable()
export class UsersRepository {
    constructor(
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>
    ) { }

    async create(data: typeof schema.users.$inferInsert) {
        return this.db.insert(schema.users).values(data).returning();
    }

    async findById(id: string) {
        return this.db.query.users.findFirst({
            where: eq(schema.users.id, id),
        });
    }

    async findByEmail(email: string) {
        const [user] = await this.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email));
        return user;
    }

    async findAll() {
        return this.db
            .select({
                id: schema.users.id,
                name: schema.users.name,
                email: schema.users.email,
                createdAt: schema.users.createdAt,
            })
            .from(schema.users);
    }

    async update(id: string, data: Partial<typeof schema.users.$inferInsert>) {
        return this.db
            .update(schema.users)
            .set(data)
            .where(eq(schema.users.id, id))
            .returning();
    }

    async delete(id: string) {
        return this.db
            .delete(schema.users)
            .where(eq(schema.users.id, id))
            .returning();
    }

    async countAdmins(): Promise<number> {
        const result = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(schema.users)
            .where(eq(schema.users.isAdmin, true));
        return Number(result[0].count);
    }
}
