import { resolveGalleryMediaTargetFromManifest } from './media-core'
import { serverManifest } from './server-manifest'

export { buildStorageObjectKey } from './media-core'

export const resolveGalleryMediaTarget = (photoId: string, kind: 'live-video' | 'original') =>
  resolveGalleryMediaTargetFromManifest(serverManifest, photoId, kind)
