import type { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { PhotoManifestItem } from '@afilmory/typing'
import sharp from 'sharp'

import { workdir } from '../path.js'

export const PREVIEW_MAX_EDGE = 2048

export function getPreviewPath(photoId: string) {
  return path.join(workdir, 'public/previews', `${photoId}.jpg`)
}

export async function previewExists(photoId: string) {
  try {
    await fs.access(getPreviewPath(photoId))
    return true
  }
  catch {
    return false
  }
}

export async function encodePhotoPreview(imageBuffer: Buffer, limitInputPixels?: number | boolean) {
  return sharp(imageBuffer, { limitInputPixels })
    .rotate()
    .resize({ width: PREVIEW_MAX_EDGE, height: PREVIEW_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
}

export async function generatePhotoPreview(
  imageBuffer: Buffer,
  photoId: string,
  existingItem: PhotoManifestItem | undefined,
  regenerate: boolean,
  persistToDisk: boolean,
  limitInputPixels?: number | boolean,
) {
  if (!regenerate && existingItem?.previewDigest && existingItem.previewWidth && existingItem.previewHeight && await previewExists(photoId)) {
    return {
      previewUrl: `/previews/${photoId}.jpg`,
      previewDigest: existingItem.previewDigest,
      previewWidth: existingItem.previewWidth,
      previewHeight: existingItem.previewHeight,
    }
  }

  const { data, info } = await encodePhotoPreview(imageBuffer, limitInputPixels)
  if (persistToDisk) {
    const target = getPreviewPath(photoId)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, data)
  }
  return {
    previewUrl: `/previews/${photoId}.jpg`,
    previewDigest: crypto.createHash('sha256').update(data).digest('hex'),
    previewWidth: info.width,
    previewHeight: info.height,
  }
}
