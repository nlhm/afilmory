import 'dotenv-expand/config'

import { getEnv } from '@env'
import { defineConfig } from 'drizzle-kit'

const env = getEnv()

export default defineConfig({
  dialect: 'postgresql',
  dbCredentials: {
    url: env.PG_CONNECTION_STRING,
  },
  schema: './src/schemas',
  out: './drizzle',
})
