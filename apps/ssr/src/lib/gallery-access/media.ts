import { resolveGalleryMediaTargetFromManifest } from './media-core'
import { getServerManifest } from './server-manifest'

export { buildStorageObjectKey } from './media-core'

export const resolveGalleryMediaTarget = (photoId: string, kind: 'live-video' | 'original') =>
  resolveGalleryMediaTargetFromManifest(getServerManifest(), photoId, kind)
