import type { PhotoManifest } from '~/types/photo'

import { parseFocalLength } from '../../lib/exif-focal-length'

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
  const grouped = new Map<number, PhotoManifest[]>()
  const missingPhotos: PhotoManifest[] = []
  for (const photo of scopedPhotos) {
    const focalLength = parseFocalLength(photo.exif?.FocalLength)
    if (focalLength === null) {
      missingPhotos.push(photo)
      continue
    }
    const group = grouped.get(focalLength)
    if (group) {
      group.push(photo)
    }
    else {
      grouped.set(focalLength, [photo])
    }
  }
  const validCount = scopedPhotos.length - missingPhotos.length
  const groups = [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([focalLength, photos]) => ({
      focalLength,
      photos,
      count: photos.length,
      share: photos.length / validCount,
    }))
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
      !best || group.count > best.count || (group.count === best.count && group.focalLength < best.focalLength)
        ? group
        : best,
    undefined,
  )
}
