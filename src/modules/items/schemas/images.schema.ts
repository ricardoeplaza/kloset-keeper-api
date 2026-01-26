// items/schemas/images.schema.ts
import { pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const imageStatusEnum = pgEnum('status', [
    'processing', 'ready', 'failed'
]);

export const images = pgTable('images', {
    id: uuid('id').defaultRandom().primaryKey(),
    hash: varchar('hash', { length: 64 }).unique().notNull(),

    // Rutas de archivos
    storagePath: text('storage_path'), // Imagen final .webp
    thumbPath: text('thumb_path').notNull(), // El thumb (primero raw, luego final)

    // Estado del pipeline
    status: imageStatusEnum('status').default('processing'), // 'processing' | 'ready' | 'failed'

    createdAt: timestamp('created_at').defaultNow(),
});