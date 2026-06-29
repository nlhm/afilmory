import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type { ServerGalleryManifest } from './manifest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MANIFEST_CANDIDATE_PATHS = [
  path.resolve(__dirname, '../../../web/src/data/photos-manifest.json'),
  path.resolve(__dirname, '../../../../../packages/data/src/photos-manifest.json'),
  path.resolve(process.cwd(), 'src/data/photos-manifest.json'),
]

let _cached: ServerGalleryManifest | undefined

export const getServerManifest = (): ServerGalleryManifest => {
  if (_cached) return _cached

  for (const candidatePath of MANIFEST_CANDIDATE_PATHS) {
    if (!existsSync(candidatePath)) {
      continue
    }

    _cached = JSON.parse(readFileSync(candidatePath, 'utf8')) as ServerGalleryManifest
    return _cached
  }

  throw new Error(`Unable to locate photos-manifest.json. Checked: ${MANIFEST_CANDIDATE_PATHS.join(', ')}`)
}
