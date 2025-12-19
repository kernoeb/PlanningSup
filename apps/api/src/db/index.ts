import { SQL } from 'bun'
import config from '@api/config'
import { defaultLogger as logger } from '@api/utils/logger'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import * as schemaAuth from './schemas/auth'
import * as schemaPlannings from './schemas/plannings'

const DATABASE_URL = config.databaseUrl
if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is not set')

const client = new SQL(DATABASE_URL)
const db = drizzle({
  client,
  schema: { ...schemaPlannings, ...schemaAuth },
})

// Wait for database to be ready
logger.info('Connecting to database...')
await client.connect()
logger.info('Database connected.')

if (!config.noMigrateDatabase) {
  logger.info('Running migrations if needed...')
  await migrate(db, { migrationsFolder: './drizzle' })
  logger.info('Migrations complete.')
}

export { client, db }
export type Database = typeof db
