import { index, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

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

export const planningsRefreshQueueTable = pgTable('plannings_refresh_queue', {
  planningFullId: varchar('planning_full_id', { length: 255 })
    .notNull()
    .primaryKey()
    .references(() => planningsTable.fullId, { onDelete: 'cascade' }),
  priority: integer('priority').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockOwner: text('lock_owner'),
  lastError: text('last_error'),
}, table => [
  index('plannings_refresh_queue_next_attempt_at_idx').on(table.nextAttemptAt),
  index('plannings_refresh_queue_priority_idx').on(table.priority),
  index('plannings_refresh_queue_pick_idx').on(table.nextAttemptAt, table.priority, table.requestedAt),
])

export const planningsRefreshStateTable = pgTable('plannings_refresh_state', {
  planningFullId: varchar('planning_full_id', { length: 255 })
    .notNull()
    .primaryKey()
    .references(() => planningsTable.fullId, { onDelete: 'cascade' }),
  disabledUntil: timestamp('disabled_until', { withTimezone: true }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  lastFailureKind: text('last_failure_kind'),
  lastError: text('last_error'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('plannings_refresh_state_disabled_until_idx').on(table.disabledUntil),
])

export const table = {
  planningsTable,
  planningsBackupTable,
  planningsRefreshQueueTable,
  planningsRefreshStateTable,
} as const

export type Table = typeof table
