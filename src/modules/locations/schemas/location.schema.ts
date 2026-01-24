import { AnyPgColumn, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const locations = pgTable('locations', {
    // Primary Key as UUID
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    // Type of location (e.g., 'room', 'closet', 'shelf')
    type: text('type'),
    // Foreign Key must also be uuid to match the id type
    parentId: uuid('parent_id').references((): AnyPgColumn => locations.id, { onDelete: 'cascade' }),
});