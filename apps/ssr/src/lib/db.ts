import { getEnv } from '@env'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../schemas'

const createDrizzle = (client: postgres.Sql) => drizzle({ client, schema, logger: true })

export class DbManager {
  private client: postgres.Sql | undefined
  private drizzle: ReturnType<typeof createDrizzle> | undefined
  private ready = false

  static shared = new DbManager()

  private constructor() {}

  isEnabled() {
    return getEnv().PG_CONNECTION_STRING !== undefined
  }

  isReady() {
    return this.ready
  }

  async connect() {
    if (!this.isEnabled()) {
      return
    }

    this.client = postgres(getEnv().PG_CONNECTION_STRING!, {
      prepare: false,
    })
    this.ready = true

    this.drizzle = createDrizzle(this.client)
  }

  getDb() {
    if (!this.isEnabled()) {
      throw new Error('Database is not enabled')
    }

    if (!this.isReady()) {
      throw new Error('Database is not ready')
    }

    return this.drizzle
  }

  getPool() {
    if (!this.isEnabled()) {
      throw new Error('Database is not enabled')
    }

    return this.client
  }
}
