import type { PhotoManifestItem } from '@afilmory/builder'

import { getServerManifest } from './gallery-access/server-manifest'

class PhotoLoader {
  private photos: PhotoManifestItem[] | undefined
  private photoMap: Record<string, PhotoManifestItem> | undefined

  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)
  }

  private ensureLoaded() {
    if (this.photos) return
    this.photos = getServerManifest().data as unknown as PhotoManifestItem[]
    this.photoMap = {}
    this.photos.forEach((photo) => {
      this.photoMap![photo.id] = photo
    })
  }

  getPhotos(ids?: string[]) {
    this.ensureLoaded()
    if (ids) {
      return this.photos!.filter((photo) => ids.includes(photo.id))
    }
    return this.photos!
  }

  getPhoto(id: string) {
    this.ensureLoaded()
    return this.photoMap![id]
  }

  getAllTags() {
    this.ensureLoaded()
    const tagSet = new Set<string>()
    this.photos!.forEach((photo) => {
      photo.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }
}
export const photoLoader = new PhotoLoader()
