import { boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  isAdmin: boolean('admin').default(false),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: text('password').notNull(), // bcrypt hash
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});