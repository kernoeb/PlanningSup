import { index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const planningsTable = pgTable('plannings', {
  fullId: varchar('full_id', { length: 255 }).notNull().primaryKey(),
  planningId: varchar('planning_id', { length: 255 }).notNull(),
  url: text('url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  title: text('title'),
}, table => [
  index('plannings_title_idx').on(table.title),
])

export const planningsBackupTable = pgTable('plannings_backup', {
  planningFullId: varchar('planning_full_id', { length: 255 })
    .notNull()
    .primaryKey()
    .references(() => planningsTable.fullId, { onDelete: 'cascade' }),
  events: jsonb('events').$type<{
    uid: string
    summary: string
    startDate: Date
    endDate: Date
    location: string
    description: string
  }[]>().notNull(),
  signature: text('signature').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('plannings_backup_latest_updated_at_idx').on(table.updatedAt),
])

export const table = {
  planningsTable,
  planningsBackupTable,
} as const

export type Table = typeof table
