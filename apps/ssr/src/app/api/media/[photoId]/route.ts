import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import type { NextRequest } from 'next/server'

import { requireGallerySession } from '~/lib/gallery-access/request'
import { buildStorageObjectKey } from '~/lib/gallery-access/media-core'
import type { GalleryMediaKind } from '~/lib/gallery-access/media-core'

interface MediaRouteContext {
  params: Promise<{ photoId: string }>
}

interface MediaRouteDependencies {
  bucketName: string
  expiresInSeconds: number
  prefix?: string
  resolveMediaTarget: (photoId: string, kind: GalleryMediaKind) => ReturnType<typeof import('~/lib/gallery-access/media-core').resolveGalleryMediaTargetFromManifest>
  s3Client: object
  signUrl: (client: object, command: GetObjectCommand | HeadObjectCommand, options: { expiresIn: number }) => Promise<string>
}

const NOT_FOUND_RESPONSE = new Response('Not Found', {
  headers: {
    'Cache-Control': 'private, no-store',
  },
  status: 404,
})

const getMediaKind = (request: Request) => {
  const kind = new URL(request.url).searchParams.get('kind')
  return kind === 'original' || kind === 'live-video' ? kind : null
}

const createSignedObjectCommand = (method: 'GET' | 'HEAD', bucketName: string, objectKey: string) =>
  method === 'HEAD'
    ? new HeadObjectCommand({ Bucket: bucketName, Key: objectKey })
    : new GetObjectCommand({ Bucket: bucketName, Key: objectKey })

export const handleMediaRequest = async (
  request: NextRequest,
  context: MediaRouteContext,
  dependencies: MediaRouteDependencies,
) => {
  const unauthorized = requireGallerySession(request)
  if (unauthorized) {
    return unauthorized
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return NOT_FOUND_RESPONSE
  }

  const kind = getMediaKind(request)
  if (!kind) {
    return NOT_FOUND_RESPONSE
  }

  const { photoId } = await context.params
  const mediaTarget = dependencies.resolveMediaTarget(photoId, kind)
  if (!mediaTarget) {
    return NOT_FOUND_RESPONSE
  }

  const objectKey = buildStorageObjectKey(dependencies.prefix, mediaTarget.objectKey)
  const command = createSignedObjectCommand(request.method, dependencies.bucketName, objectKey)
  const signedUrl = await dependencies.signUrl(dependencies.s3Client as never, command, {
    expiresIn: dependencies.expiresInSeconds,
  })

  return new Response(null, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Location': signedUrl,
    },
    status: 307,
  })
}

const getDependencies = async (): Promise<MediaRouteDependencies> => {
  const [{ resolveGalleryMediaTarget }, { getGalleryMediaStorageConfig, getSignedUrl }] = await Promise.all([
    import('~/lib/gallery-access/media'),
    import('~/lib/gallery-access/r2'),
  ])
  const config = getGalleryMediaStorageConfig()

  return {
    ...config,
    resolveMediaTarget: resolveGalleryMediaTarget,
    signUrl: getSignedUrl,
  }
}

export const GET = async (request: NextRequest, context: MediaRouteContext) =>
  handleMediaRequest(request, context, await getDependencies())

export const HEAD = async (request: NextRequest, context: MediaRouteContext) =>
  handleMediaRequest(request, context, await getDependencies())
