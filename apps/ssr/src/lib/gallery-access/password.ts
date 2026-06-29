import { Buffer } from 'node:buffer'
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 32
const SCRYPT_COST = 16_384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_PREFIX = 'scrypt'

const deriveKey = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_COST,
        p: SCRYPT_PARALLELIZATION,
        r: SCRYPT_BLOCK_SIZE,
      },
      (error, key) => {
        if (error) {
          reject(error)
          return
        }

        resolve(key)
      },
    )
  })

const decodeBase64Url = (value: string) => {
  if (!/^[\w-]+$/.test(value)) {
    return null
  }

  return Buffer.from(value, 'base64url')
}

export const hashGalleryPassword = async (password: string) => {
  if (!password) {
    throw new Error('Gallery password must not be empty')
  }

  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)

  return [
    SCRYPT_PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export const verifyGalleryPassword = async (password: string, serializedHash: string) => {
  const [prefix, cost, blockSize, parallelization, encodedSalt, encodedKey, extra] = serializedHash.split('$')

  if (
    extra !== undefined
    || prefix !== SCRYPT_PREFIX
    || cost !== String(SCRYPT_COST)
    || blockSize !== String(SCRYPT_BLOCK_SIZE)
    || parallelization !== String(SCRYPT_PARALLELIZATION)
  ) {
    return false
  }

  const salt = decodeBase64Url(encodedSalt || '')
  const expectedKey = decodeBase64Url(encodedKey || '')

  if (!salt || salt.length !== 16 || !expectedKey || expectedKey.length !== KEY_LENGTH) {
    return false
  }

  const actualKey = await deriveKey(password, salt)
  return timingSafeEqual(actualKey, expectedKey)
}
