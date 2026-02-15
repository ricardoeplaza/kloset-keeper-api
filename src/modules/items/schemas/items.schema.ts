import { AnyPgColumn, boolean, pgEnum, pgTable, text, timestamp, uuid, varchar, vector } from 'drizzle-orm/pg-core';
import { locations } from '../../locations/schemas/location.schema';
import { users } from '../../users/schemas/users.schema';
import { images } from './images.schema';

export const categoryEnum = pgEnum('item_category', [
    'top', 'bottom', 'footwear', 'accessory', 'outerwear'
]);

export const processingStatusEnum = pgEnum('processing_status', [
  'pending', 'ready', 'failed'
]);

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  brand: varchar('brand', { length: 100 }),
  name: varchar('name', { length: 100 }).notNull(),
  category: categoryEnum('category').notNull(),
  purchaseDate: timestamp('purchase_date'),
  
  // Physical attributes
  color: text('color').array(),
  material: text('material').array(),
  size: varchar('size', { length: 20 }),
  notes: text('notes'),

  locationId: uuid('location_id').references(() => locations.id),
  imageId: uuid('image_id').references((): AnyPgColumn => images.id, { onDelete: 'cascade' }).notNull(),
  ownerId: uuid('owner_id').references((): AnyPgColumn => users.id, { onDelete: 'cascade' }).notNull(),

  embedding: vector('embedding', { dimensions: 512 }),
  embeddingModel: text('embedding_model'),
  embeddingstatus: processingStatusEnum('embedding_status').notNull().default('pending'),
  isMultimodal: boolean('is_multimodal').default(false), // if embedding contain 'name' and 'notes'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});