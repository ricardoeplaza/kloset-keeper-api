import { AnyPgColumn, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../users/schemas/users.schema';

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type'), // e.g., 'room', 'closet', 'shelf'
  parentId: uuid('parent_id').references((): AnyPgColumn => locations.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
});