import { pgTable, text, varchar, vector } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
    name: varchar('name', { length: 100 }).primaryKey().notNull(),
    prompt: text('prompt').notNull(),
    embedding: vector('embedding', { dimensions: 512 }),
});