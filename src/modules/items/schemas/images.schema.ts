import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../../users/schemas/users.schema';

const processingStatusEnum = pgEnum('processing_status', [
  'pending', 'ready', 'failed'
]);

export const images = pgTable('images', {
  id: uuid('id').primaryKey().defaultRandom(),
  hash: varchar('hash', { length: 64 }).unique().notNull(),
  storagePath: text('storage_path').notNull(),
  thumbPath: text('thumb_path').notNull(),
  status: processingStatusEnum('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  index('hash_idx').on(table.hash),
]);