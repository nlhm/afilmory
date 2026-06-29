import type { ServerGalleryManifest, ServerPhotoManifestItem } from './manifest'

export type GalleryMediaKind = 'live-video' | 'original'

const hasLivePhotoVideo = (
  video: ServerPhotoManifestItem['video'],
): video is Extract<NonNullable<ServerPhotoManifestItem['video']>, { type: 'live-photo' }> =>
  video?.type === 'live-photo' && typeof video.s3Key === 'string' && video.s3Key.length > 0

const normalizeObjectKey = (key: string) => key.replace(/^\/+/, '')

export const buildStorageObjectKey = (prefix: string | undefined, key: string) => {
  const normalizedKey = normalizeObjectKey(key)
  const normalizedPrefix = prefix?.trim().replace(/^\/+|\/+$/g, '')

  return normalizedPrefix ? `${normalizedPrefix}/${normalizedKey}` : normalizedKey
}

export const resolveGalleryMediaTargetFromManifest = (
  manifest: ServerGalleryManifest,
  photoId: string,
  kind: GalleryMediaKind,
) => {
  const photo = manifest.data.find(item => item.id === photoId)
  if (!photo) {
    return null
  }

  if (kind === 'original') {
    return {
      contentType: 'image',
      objectKey: normalizeObjectKey(photo.s3Key),
      photo,
    }
  }

  if (!hasLivePhotoVideo(photo.video)) {
    return null
  }

  return {
    contentType: 'video',
    objectKey: normalizeObjectKey(photo.video.s3Key),
    photo,
  }
}
