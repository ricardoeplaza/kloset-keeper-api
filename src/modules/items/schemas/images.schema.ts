import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../../users/schemas/users.schema';

export const imageStatusEnum = pgEnum('status', [
  'processing', 'ready', 'failed'
]);

export const images = pgTable('images', {
  id: uuid('id').primaryKey().defaultRandom(),
  hash: varchar('hash', { length: 64 }).unique().notNull(),
  storagePath: text('storage_path'),
  thumbPath: text('thumb_path').notNull(),
  status: imageStatusEnum('status').default('processing'), // Defined in your enums
  createdAt: timestamp('created_at').defaultNow().notNull(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  hashIdx: index('hash_idx').on(table.hash),
}));