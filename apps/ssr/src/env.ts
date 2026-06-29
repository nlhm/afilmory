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

let _cached: ReturnType<typeof createEnv<{ GALLERY_PASSWORD_HASH: string; GALLERY_SESSION_SECRET: string; PG_CONNECTION_STRING: string | undefined; S3_ACCESS_KEY_ID: string; S3_BUCKET_NAME: string; S3_ENDPOINT: string; S3_PREFIX: string | undefined; S3_REGION: string; S3_SECRET_ACCESS_KEY: string }, {}, {}>> | undefined

export const getEnv = () => {
  if (_cached) return _cached

  _cached = createEnv({
    server: {
      GALLERY_PASSWORD_HASH: gallerySecret('GALLERY_PASSWORD_HASH'),
      GALLERY_SESSION_SECRET: gallerySecret('GALLERY_SESSION_SECRET'),
      PG_CONNECTION_STRING: z.string().min(1).optional(),
      S3_ACCESS_KEY_ID: gallerySecret('S3_ACCESS_KEY_ID'),
      S3_BUCKET_NAME: gallerySecret('S3_BUCKET_NAME'),
      S3_ENDPOINT: gallerySecret('S3_ENDPOINT'),
      S3_PREFIX: z.string().optional(),
      S3_REGION: gallerySecret('S3_REGION'),
      S3_SECRET_ACCESS_KEY: gallerySecret('S3_SECRET_ACCESS_KEY'),
    },
    runtimeEnv: {
      GALLERY_PASSWORD_HASH: process.env.GALLERY_PASSWORD_HASH,
      GALLERY_SESSION_SECRET: process.env.GALLERY_SESSION_SECRET,
      PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_PREFIX: process.env.S3_PREFIX,
      S3_REGION: process.env.S3_REGION,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    },
    emptyStringAsUndefined: true,
  })

  return _cached
}
