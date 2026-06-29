import process from 'node:process'

import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

const gallerySecret = (name: string) => {
  if (process.env.NODE_ENV !== 'production') {
    return z.string().min(1).optional()
  }

  return name === 'GALLERY_SESSION_SECRET'
    ? z.string().min(32, `${name} must be at least 32 characters in production`)
    : z.string().min(1, `${name} is required in production`)
}

export const env = createEnv({
  server: {
    GALLERY_PASSWORD_HASH: gallerySecret('GALLERY_PASSWORD_HASH'),
    GALLERY_SESSION_SECRET: gallerySecret('GALLERY_SESSION_SECRET'),
    PG_CONNECTION_STRING: z.string().min(1).optional(),
  },
  runtimeEnv: {
    GALLERY_PASSWORD_HASH: process.env.GALLERY_PASSWORD_HASH,
    GALLERY_SESSION_SECRET: process.env.GALLERY_SESSION_SECRET,
    PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  },
  emptyStringAsUndefined: true,
})
