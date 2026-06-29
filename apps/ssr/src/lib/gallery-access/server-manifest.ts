import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type { ServerGalleryManifest } from './manifest'

const MANIFEST_CANDIDATE_PATHS = [
  fileURLToPath(new URL('../../../web/src/data/photos-manifest.json', import.meta.url)),
  fileURLToPath(new URL('../../../../packages/data/src/photos-manifest.json', import.meta.url)),
  path.resolve(process.cwd(), 'src/data/photos-manifest.json'),
]

const loadServerManifest = (): ServerGalleryManifest => {
  for (const candidatePath of MANIFEST_CANDIDATE_PATHS) {
    if (!existsSync(candidatePath)) {
      continue
    }

    return JSON.parse(readFileSync(candidatePath, 'utf8')) as ServerGalleryManifest
  }

  throw new Error(`Unable to locate photos-manifest.json. Checked: ${MANIFEST_CANDIDATE_PATHS.join(', ')}`)
}

export const serverManifest = loadServerManifest()
