import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const GALLERY_ACCESS_COOKIE_NAME = 'afilmory_gallery_access'
export const GALLERY_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30

const TOKEN_VERSION = 'v1'

interface SessionTokenOptions {
  expiresAt?: number
  now?: number
}

interface CookieOptions {
  now?: number
  secure: boolean
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest()

export const createGallerySessionToken = (secret: string, options: SessionTokenOptions = {}) => {
  if (!secret) {
    throw new Error('Gallery session secret must not be empty')
  }

  const issuedAt = Math.floor((options.now ?? Date.now()) / 1000)
  const expiresAt = options.expiresAt ?? issuedAt + GALLERY_SESSION_DURATION_SECONDS
  const payload = `${TOKEN_VERSION}.${issuedAt}.${expiresAt}`
  const signature = sign(payload, secret).toString('base64url')

  return `${payload}.${signature}`
}

export const verifyGallerySessionToken = (token: string, secret: string, now = Date.now()) => {
  if (!token || !secret) {
    return false
  }

  const [version, issuedAtValue, expiresAtValue, encodedSignature, extra] = token.split('.')
  if (
    extra !== undefined
    || version !== TOKEN_VERSION
    || !/^\d+$/.test(issuedAtValue)
    || !/^\d+$/.test(expiresAtValue)
  ) {
    return false
  }

  const issuedAt = Number(issuedAtValue)
  const expiresAt = Number(expiresAtValue)
  const nowInSeconds = Math.floor(now / 1000)

  if (
    !Number.isSafeInteger(issuedAt)
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > GALLERY_SESSION_DURATION_SECONDS
    || nowInSeconds >= expiresAt
  ) {
    return false
  }

  if (!/^[\w-]+$/.test(encodedSignature || '')) {
    return false
  }

  const actualSignature = Buffer.from(encodedSignature, 'base64url')
  const expectedSignature = sign(`${version}.${issuedAtValue}.${expiresAtValue}`, secret)

  return actualSignature.length === expectedSignature.length && timingSafeEqual(actualSignature, expectedSignature)
}

const cookieSecurityAttributes = (secure: boolean) => `Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax`

export const createGallerySessionCookie = (secret: string, options: CookieOptions) => {
  const now = options.now ?? Date.now()
  const expires = new Date(now + GALLERY_SESSION_DURATION_SECONDS * 1000)
  const token = createGallerySessionToken(secret, { now })

  return `${GALLERY_ACCESS_COOKIE_NAME}=${token}; Max-Age=${GALLERY_SESSION_DURATION_SECONDS}; Expires=${expires.toUTCString()}; ${cookieSecurityAttributes(options.secure)}`
}

export const clearGallerySessionCookie = (secure: boolean) =>
  `${GALLERY_ACCESS_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieSecurityAttributes(secure)}`
