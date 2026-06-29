import process from 'node:process'

import { getEnv } from '@env'

export const getGalleryAccessConfig = () => {
  const env = getEnv()
  if (!env.GALLERY_PASSWORD_HASH || !env.GALLERY_SESSION_SECRET) {
    throw new Error('Gallery access is not configured. Set GALLERY_PASSWORD_HASH and GALLERY_SESSION_SECRET.')
  }

  return {
    passwordHash: env.GALLERY_PASSWORD_HASH,
    secureCookie: process.env.NODE_ENV === 'production',
    sessionSecret: env.GALLERY_SESSION_SECRET,
  }
}
