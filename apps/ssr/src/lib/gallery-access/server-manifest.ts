import type { ServerGalleryManifest } from './manifest'
import { embeddedManifest } from '../../data/photos-manifest-embedded'

export const getServerManifest = (): ServerGalleryManifest => {
  return embeddedManifest
}
