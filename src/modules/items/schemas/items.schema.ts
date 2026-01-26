import { AnyPgColumn, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { locations } from '../../locations/schemas/location.schema';
import { images } from './images.schema';

export const categoryEnum = pgEnum('item_category', [
    'top', 'bottom', 'footwear', 'accessory', 'outerwear'
]);

export const items = pgTable('items', {
    id: uuid('id').primaryKey().defaultRandom().primaryKey(),
    brand: varchar('brand', { length: 100 }),
    name: varchar('name', { length: 100 }).notNull(),
    category: categoryEnum('category').notNull(),
    purchaseDate: timestamp('purchase_date'),

    // Atributos físicos
    color: text('color').array(),
    material: text('material').array(),
    size: varchar('size', { length: 20 }),
    notes: text('notes'),

    location: uuid('location_id').references(() => locations.id),
    image: uuid('image_id').references((): AnyPgColumn => images.id, { onDelete: 'cascade' }).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});