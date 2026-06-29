import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, '../../web/src/data/photos-manifest.json')
const outputPath = resolve(__dirname, '../src/data/photos-manifest-embedded.ts')

mkdirSync(dirname(outputPath), { recursive: true })

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const content = `// Auto-generated during build - do not edit
import type { ServerGalleryManifest } from '~/lib/gallery-access/manifest'

export const embeddedManifest: ServerGalleryManifest = ${JSON.stringify(manifest)} as ServerGalleryManifest
`

writeFileSync(outputPath, content)
console.log('✓ Embedded manifest generated')
