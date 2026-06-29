import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest } from 'next/server'

import type { ServerGalleryManifest, ServerPhotoManifestItem } from './manifest'
import { resolveGalleryMediaTargetFromManifest } from './media-core'
import { createGallerySessionToken, GALLERY_ACCESS_COOKIE_NAME } from './session'

const SESSION_SECRET = 'test-session-secret-with-at-least-thirty-two-characters'

process.env.GALLERY_PASSWORD_HASH ??= 'scrypt$16384$8$1$bbbbbbbbbbbbbbbbbbbbbb$ccccccccccccccccccccccccccccccccccccccccccc'
process.env.GALLERY_SESSION_SECRET ??= SESSION_SECRET

const { handleMediaRequest } = await import('../../app/api/media/[photoId]/route')

const createRequest = (path: string, options: { cookie?: string, method?: 'GET' | 'HEAD' } = {}) =>
  new NextRequest(`https://gallery.test${path}`, {
    headers: options.cookie ? { cookie: options.cookie } : {},
    method: options.method ?? 'GET',
  })

const createSessionCookie = () =>
  `${GALLERY_ACCESS_COOKIE_NAME}=${createGallerySessionToken(SESSION_SECRET)}`

const mediaManifest: ServerGalleryManifest = {
  version: 'v10',
  cameras: [],
  data: [
    {
      id: 'private/photo 01',
      title: 'Private photo',
      description: 'Private photo',
      dateTaken: '2026-06-29T00:00:00.000Z',
      tags: ['private'],
      originalUrl: 'https://assets.woodbrook.cn/originals/private-photo.jpg',
      thumbnailUrl: 'https://assets.woodbrook.cn/thumbnails/private-photo.jpg',
      thumbHash: null,
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
      format: 'JPG',
      s3Key: 'originals/private-photo.jpg',
      lastModified: '2026-06-29T00:00:00.000Z',
      size: 123,
      exif: null,
      toneAnalysis: null,
      location: null,
      video: {
        type: 'live-photo',
        videoUrl: 'https://assets.woodbrook.cn/originals/private-photo.mov',
        s3Key: 'originals/private-photo.mov',
      },
    } as ServerPhotoManifestItem,
  ],
  lenses: [],
}

const resolveMediaTarget = (photoId: string, kind: 'live-video' | 'original') =>
  resolveGalleryMediaTargetFromManifest(mediaManifest, photoId, kind)

test('media route returns 401 without a valid session', async () => {
  const response = await handleMediaRequest(
    createRequest('/api/media/private%2Fphoto%2001?kind=original'),
    { params: Promise.resolve({ photoId: 'private/photo 01' }) },
    {
      bucketName: 'private-gallery',
      expiresInSeconds: 300,
      prefix: 'gallery',
      resolveMediaTarget,
      s3Client: {},
      signUrl: async () => 'https://example.invalid',
    },
  )

  assert.equal(response.status, 401)
  assert.equal(response.headers.get('location'), null)
})

test('media route signs only manifest-backed original media with a five-minute TTL', async () => {
  const seen: { command?: unknown, expiresIn?: number } = {}
  const response = await handleMediaRequest(
    createRequest('/api/media/private%2Fphoto%2001?kind=original', { cookie: createSessionCookie() }),
    { params: Promise.resolve({ photoId: 'private/photo 01' }) },
    {
      bucketName: 'private-gallery',
      expiresInSeconds: 300,
      prefix: 'gallery-prefix',
      resolveMediaTarget,
      s3Client: { marker: 's3' },
      signUrl: async (_client, command, options) => {
        seen.command = command
        seen.expiresIn = options.expiresIn
        return 'https://example.r2.cloudflarestorage.com/private-gallery/gallery-prefix/originals/private-photo.jpg?X-Amz-Expires=300'
      },
    },
  )

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('location') || '', /X-Amz-Expires=300/)
  assert.equal(seen.expiresIn, 300)
  assert.equal((seen.command as { input: { Bucket: string, Key: string } }).input.Bucket, 'private-gallery')
  assert.equal((seen.command as { input: { Bucket: string, Key: string } }).input.Key, 'gallery-prefix/originals/private-photo.jpg')
})

test('media route uses HEAD signing for HEAD requests and rejects caller-selected targets', async () => {
  let seenCommand: unknown

  const headResponse = await handleMediaRequest(
    createRequest('/api/media/private%2Fphoto%2001?kind=live-video', {
      cookie: createSessionCookie(),
      method: 'HEAD',
    }),
    { params: Promise.resolve({ photoId: 'private/photo 01' }) },
    {
      bucketName: 'private-gallery',
      expiresInSeconds: 300,
      prefix: undefined,
      resolveMediaTarget,
      s3Client: {},
      signUrl: async (_client, command) => {
        seenCommand = command
        return 'https://example.r2.cloudflarestorage.com/private-gallery/originals/private-photo.mov?X-Amz-Expires=300'
      },
    },
  )

  assert.equal(headResponse.status, 307)
  assert.equal(seenCommand instanceof HeadObjectCommand, true)

  for (const photoId of ['missing-photo-id', '../originals/private-photo.jpg', 'https://assets.woodbrook.cn/originals/private-photo.jpg']) {
    const response = await handleMediaRequest(
      createRequest(`/api/media/${encodeURIComponent(photoId)}?kind=original`, { cookie: createSessionCookie() }),
      { params: Promise.resolve({ photoId }) },
      {
        bucketName: 'private-gallery',
        expiresInSeconds: 300,
        prefix: undefined,
        resolveMediaTarget,
        s3Client: {},
        signUrl: async () => {
          throw new Error('signUrl should not be called for unknown media')
        },
      },
    )

    assert.equal(response.status, 404)
    assert.equal(response.headers.get('location'), null)
  }

  const unsupportedKindResponse = await handleMediaRequest(
    createRequest('/api/media/private%2Fphoto%2001?kind=https://example.com', { cookie: createSessionCookie() }),
    { params: Promise.resolve({ photoId: 'private/photo 01' }) },
    {
      bucketName: 'private-gallery',
      expiresInSeconds: 300,
      prefix: undefined,
      resolveMediaTarget,
      s3Client: {},
      signUrl: async () => {
        throw new Error('signUrl should not be called for unsupported kinds')
      },
    },
  )

  assert.equal(unsupportedKindResponse.status, 404)
})
