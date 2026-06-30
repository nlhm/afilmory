import type { PhotoManifestItem } from '@afilmory/typing'

import type { PhotoProcessorOptions } from './processor.js'

export function canReuseThumbnail(
  existingItem: PhotoManifestItem | undefined,
  options: PhotoProcessorOptions,
  sourceChanged: boolean,
): existingItem is PhotoManifestItem & { thumbHash: string } {
  return Boolean(!options.isForceMode && !options.isForceThumbnails && !sourceChanged && existingItem?.thumbHash)
}
