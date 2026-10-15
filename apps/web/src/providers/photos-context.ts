import { createContext } from 'react'

import type { PhotoManifest } from '~/types/photo'

export const PhotoRouteBaseContext = createContext('')
export const PhotosContext = createContext<PhotoManifest[]>(null!)
