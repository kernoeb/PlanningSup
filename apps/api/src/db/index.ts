import { SQL } from 'bun'
import { defaultLogger as logger } from '@api/utils/logger'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import * as schemaAuth from './schemas/auth'
import * as schemaPlannings from './schemas/plannings'

const DATABASE_URL = Bun.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is not set')

const client = new SQL(DATABASE_URL)
const db = drizzle({
  client,
  schema: { ...schemaPlannings, ...schemaAuth },
})

if (Bun.env.NO_MIGRATE !== 'true') {
  logger.info('Connected to database, running migrations if needed...')
  await migrate(db, { migrationsFolder: './drizzle' })
  logger.info('Migrations complete.')
}

export { client, db }
export type Database = typeof db
