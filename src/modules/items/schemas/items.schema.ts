import { AnyPgColumn, boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar, vector } from 'drizzle-orm/pg-core';
import { categories } from './categories.schema';
import { locations } from '../../locations/schemas/location.schema';
import { users } from '../../users/schemas/users.schema';
import { images } from '../../images/schemas/images.schema';

export const processingStatusEnum = pgEnum('processing_status', [
  'pending', 'ready', 'failed'
]);

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  brand: varchar('brand', { length: 100 }),
  name: varchar('name', { length: 100 }),
  category: varchar('category_id').references((): AnyPgColumn => categories.name),
  purchaseDate: timestamp('purchase_date'),

  // Physical attributes
  color_palette: jsonb('color_palette').$type<{ group: string, hex: string; percentage: number }[]>(),
  material: text('material').array(),
  size: varchar('size', { length: 20 }),
  notes: text('notes'),

  locationId: uuid('location_id').references(() => locations.id),
  imageId: uuid('image_id').references((): AnyPgColumn => images.id, { onDelete: 'cascade' }).notNull(),
  ownerId: uuid('owner_id').references((): AnyPgColumn => users.id, { onDelete: 'cascade' }).notNull(),

  embedding: vector('embedding', { dimensions: 512 }),
  embeddingModel: text('embedding_model'),
  embeddingstatus: processingStatusEnum('embedding_status').notNull().default('pending'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});