import type { PhotoManifest } from '~/types/photo'

import { parseFocalLength } from '../../lib/exif-focal-length'

export const FOCAL_LENGTH_BANDS = [
  ['ultra-wide', 0, 18],
  ['20', 18, 22],
  ['24', 22, 26],
  ['28', 26, 31.5],
  ['35', 31.5, 42.5],
  ['50', 42.5, 67.5],
  ['85', 67.5, 95],
  ['105', 95, 120],
  ['135', 120, 167.5],
  ['200', 167.5, 250],
  ['300', 250, 350],
  ['400', 350, 500],
  ['600', 500, 700],
  ['super-telephoto', 700, Infinity],
] as const

export type FocalLengthBand = {
  id: (typeof FOCAL_LENGTH_BANDS)[number][0]
  min: number
  max: number
}

const bands: FocalLengthBand[] = FOCAL_LENGTH_BANDS.map(([id, min, max]) => ({ id, min, max }))

export function getPhotoLens(photo: PhotoManifest): string | null {
  const model = photo.exif?.LensModel?.trim()
  if (!model) {
    return null
  }
  const make = photo.exif?.LensMake?.trim()
  return make ? `${make} ${model}` : model
}

export function getFocalLengthDistribution(photos: PhotoManifest[], lens: string | null = null) {
  const scopedPhotos = lens === null ? photos : photos.filter(photo => getPhotoLens(photo) === lens)
  const grouped = new Map<FocalLengthBand['id'], PhotoManifest[]>()
  const missingPhotos: PhotoManifest[] = []
  for (const photo of scopedPhotos) {
    const focalLength = parseFocalLength(photo.exif?.FocalLength)
    const band
      = focalLength === null ? undefined : bands.find(band => focalLength >= band.min && focalLength < band.max)
    if (!band) {
      missingPhotos.push(photo)
      continue
    }
    const group = grouped.get(band.id)
    if (group) {
      group.push(photo)
    }
    else {
      grouped.set(band.id, [photo])
    }
  }
  const validCount = scopedPhotos.length - missingPhotos.length
  const groups = bands.flatMap((band) => {
    const photos = grouped.get(band.id)
    return photos ? [{ band, photos, count: photos.length, share: photos.length / validCount }] : []
  })
  return { groups, totalCount: scopedPhotos.length, validCount, missingPhotos }
}

export function getLensOptions(photos: PhotoManifest[]) {
  const counts = new Map<string, number>()
  for (const photo of photos) {
    const lens = getPhotoLens(photo)
    if (lens) {
      counts.set(lens, (counts.get(lens) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([lens, count]) => ({ lens, count }))
}

export function getMostUsedFocalGroup(groups: ReturnType<typeof getFocalLengthDistribution>['groups']) {
  return groups.reduce<(typeof groups)[number] | undefined>(
    (best, group) =>
      !best || group.count > best.count || (group.count === best.count && group.band.min < best.band.min)
        ? group
        : best,
    undefined,
  )
}
