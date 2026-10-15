import type { PhotoManifest } from '~/types/photo'

import { PhotoRouteBaseContext, PhotosContext } from './photos-context'

export const PhotosProvider = ({
  children,
  photos,
  routeBase = '',
}: {
  children: React.ReactNode
  photos: PhotoManifest[]
  routeBase?: string
}) => (
  <PhotoRouteBaseContext value={routeBase}>
    <PhotosContext value={photos}>{children}</PhotosContext>
  </PhotoRouteBaseContext>
)
