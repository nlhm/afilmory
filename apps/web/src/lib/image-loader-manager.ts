import { fileTypeFromBlob } from 'file-type'

import { i18nAtom } from '~/i18n'
import { imageConverterManager } from '~/lib/image-convert'
import { jotaiStore } from '~/lib/jotai'
import { LRUCache } from '~/lib/lru-cache'
import { extractMotionPhotoVideo } from '~/lib/motion-photo-extractor'
import { convertMovToMp4, needsVideoConversion } from '~/lib/video-converter'
import type { VideoSource } from '~/modules/viewer/types'

export interface LoadingState {
  isVisible: boolean
  isHeicFormat?: boolean
  loadingProgress?: number
  loadedBytes?: number
  totalBytes?: number
  isConverting?: boolean
  isQueueWaiting?: boolean
  conversionMessage?: string
  codecInfo?: string
}

export interface LoadingCallbacks {
  onProgress?: (progress: number) => void
  onError?: () => void
  onLoadingStateUpdate?: (state: Partial<LoadingState>) => void
}

export interface ImageLoadResult {
  blobSrc: string
  convertedUrl?: string
}

export interface VideoProcessResult {
  convertedVideoUrl?: string
  conversionMethod?: string
}

export interface ImageCacheResult {
  blobSrc: string
  convertedUrl?: string
  retainedSize: number
  originalSize: number
  format: string
}

interface SharedImageLoad {
  callbacks: Set<LoadingCallbacks>
  cancelled: boolean
  downloadComplete: boolean
  lastLoadingState: Partial<LoadingState>
  promise: Promise<ImageCacheResult>
  reject: (reason?: unknown) => void
  settled: boolean
  xhr: XMLHttpRequest
}

const MAX_CACHED_IMAGE_BYTES = 256 * 1024 * 1024
let cachedImageBytes = 0

const imageCache: LRUCache<string, ImageCacheResult> = new LRUCache<string, ImageCacheResult>(
  10,
  (value, key, reason) => {
    cachedImageBytes = Math.max(0, cachedImageBytes - value.retainedSize)
    try {
      URL.revokeObjectURL(value.blobSrc)
    }
    catch (error) {
      console.warn(`Failed to revoke image blob URL (${reason}):`, error)
    }
  },
)

const inFlightImageLoads = new Map<string, SharedImageLoad>()

const createAbortError = () => new DOMException('Image loading was aborted', 'AbortError')

const updateSharedLoadingState = (request: SharedImageLoad, state: Partial<LoadingState>) => {
  request.lastLoadingState = { ...request.lastLoadingState, ...state }
  for (const callbacks of request.callbacks) {
    callbacks.onLoadingStateUpdate?.(state)
  }
}

const notifySharedProgress = (request: SharedImageLoad, progress: number) => {
  for (const callbacks of request.callbacks) {
    callbacks.onProgress?.(progress)
  }
}

const notifySharedError = (request: SharedImageLoad) => {
  for (const callbacks of request.callbacks) {
    callbacks.onError?.()
  }
}

const cacheImageResult = (src: string, result: ImageCacheResult) => {
  if (imageCache.has(src)) {
    imageCache.delete(src)
  }

  while (cachedImageBytes + result.retainedSize > MAX_CACHED_IMAGE_BYTES) {
    const oldestKey = imageCache.entries().next().value?.[0]
    if (!oldestKey) {
      break
    }
    imageCache.delete(oldestKey)
  }

  imageCache.set(src, result)
  cachedImageBytes += result.retainedSize
}

export class ImageLoaderManager {
  private activeImageLoad: { callbacks: LoadingCallbacks, request: SharedImageLoad, src: string } | null = null

  /**
   * 验证 Blob 是否为有效的图片格式
   * 使用 magic number 检测文件类型，而不是依赖 MIME 类型
   */
  private async isValidImageBlob(blob: Blob): Promise<boolean> {
    // 检查文件大小（至少应该有一些字节）
    if (blob.size === 0) {
      console.warn('Empty blob detected')
      return false
    }

    try {
      // 使用 magic number 检测文件类型
      const fileType = await fileTypeFromBlob(blob)

      if (!fileType) {
        console.warn('Could not detect file type from blob')
        return false
      }

      // 检查是否为图片格式
      const isValidImage = fileType.mime.startsWith('image/')

      if (!isValidImage) {
        console.warn(`Invalid file type detected: ${fileType.ext} (${fileType.mime})`)
        return false
      }

      return true
    }
    catch (error) {
      console.error('Failed to detect file type:', error)
      return false
    }
  }

  async loadImage(src: string, callbacks: LoadingCallbacks = {}): Promise<ImageLoadResult> {
    this.detachImageLoad()

    const cachedResult = imageCache.get(src)
    if (cachedResult) {
      callbacks.onLoadingStateUpdate?.({ isVisible: false })
      return cachedResult
    }

    let request = inFlightImageLoads.get(src)
    if (!request) {
      request = this.createSharedImageLoad(src)
      inFlightImageLoads.set(src, request)
      request.xhr.send()
    }

    request.callbacks.add(callbacks)
    this.activeImageLoad = { callbacks, request, src }

    if (Object.keys(request.lastLoadingState).length > 0) {
      callbacks.onLoadingStateUpdate?.(request.lastLoadingState)
      const progress = request.lastLoadingState.loadingProgress
      if (progress !== undefined) {
        callbacks.onProgress?.(progress)
      }
    }

    return request.promise.finally(() => {
      if (this.activeImageLoad?.request !== request) {
        return
      }

      request.callbacks.delete(callbacks)
      this.activeImageLoad = null
    })
  }

  private createSharedImageLoad(src: string): SharedImageLoad {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', src)
    xhr.responseType = 'blob'

    let resolveRequest!: (result: ImageCacheResult) => void
    let rejectRequest!: (reason?: unknown) => void

    const request: SharedImageLoad = {
      callbacks: new Set(),
      cancelled: false,
      downloadComplete: false,
      lastLoadingState: { isVisible: true },
      promise: new Promise<ImageCacheResult>((resolve, reject) => {
        resolveRequest = resolve
        rejectRequest = reject
      }),
      reject: rejectRequest,
      settled: false,
      xhr,
    }

    const rejectWithError = (error: unknown, notifyError = true) => {
      if (request.settled) {
        return
      }

      request.settled = true
      updateSharedLoadingState(request, { isVisible: false })
      if (notifyError) {
        notifySharedError(request)
      }
      rejectRequest(error)
    }

    xhr.onload = async () => {
      request.downloadComplete = true

      if (xhr.status !== 200) {
        rejectWithError(new Error(`HTTP ${xhr.status}`))
        return
      }

      try {
        const blob = xhr.response as Blob
        if (!(await this.isValidImageBlob(blob))) {
          rejectWithError(new Error('Response is not a valid image'))
          return
        }

        const result = await this.processImageBlob(blob, src, request)
        if (request.cancelled) {
          URL.revokeObjectURL(result.blobSrc)
          rejectWithError(createAbortError(), false)
          return
        }

        cacheImageResult(src, result)
        updateSharedLoadingState(request, { isVisible: false })
        request.settled = true
        resolveRequest(result)
      }
      catch (error) {
        rejectWithError(error, !request.cancelled)
      }
    }

    xhr.onprogress = (event) => {
      if (!event.lengthComputable) {
        return
      }

      const progress = (event.loaded / event.total) * 100
      updateSharedLoadingState(request, {
        loadedBytes: event.loaded,
        loadingProgress: progress,
        totalBytes: event.total,
      })
      notifySharedProgress(request, progress)
    }

    xhr.onerror = () => rejectWithError(new Error('Network error'))
    xhr.onabort = () => rejectWithError(createAbortError(), false)

    const removeInFlightRequest = () => {
      if (inFlightImageLoads.get(src) === request) {
        inFlightImageLoads.delete(src)
      }
    }
    void request.promise.then(removeInFlightRequest, removeInFlightRequest)

    return request
  }

  /**
   * 处理视频（Live Photo 或 Motion Photo）
   */
  async processVideo(
    videoSource: VideoSource,
    videoElement: HTMLVideoElement,
    callbacks: LoadingCallbacks = {},
  ): Promise<VideoProcessResult> {
    const { onLoadingStateUpdate } = callbacks

    return new Promise((resolve, reject) => {
      const processVideo = async () => {
        const i18n = jotaiStore.get(i18nAtom)

        try {
          // Pattern matching on VideoSource
          if (videoSource.type === 'motion-photo') {
            // Motion Photo: 从图片中提取嵌入视频
            onLoadingStateUpdate?.({
              isVisible: true,
              conversionMessage: i18n.t('video.motion-photo.extracting'),
            })

            const extractedVideoUrl = await extractMotionPhotoVideo(videoSource.imageUrl, {
              motionPhotoOffset: videoSource.offset,
              motionPhotoVideoSize: videoSource.size,
              presentationTimestampUs: videoSource.presentationTimestamp,
            })

            if (extractedVideoUrl) {
              videoElement.src = extractedVideoUrl
              videoElement.load()

              onLoadingStateUpdate?.({
                isVisible: false,
              })

              const result = await new Promise<VideoProcessResult>((resolveVideo) => {
                const handleVideoCanPlay = () => {
                  videoElement.removeEventListener('canplaythrough', handleVideoCanPlay)
                  resolveVideo({
                    convertedVideoUrl: extractedVideoUrl,
                    conversionMethod: 'motion-photo-extraction',
                  })
                }

                videoElement.addEventListener('canplaythrough', handleVideoCanPlay)
              })

              resolve(result)
            }
            else {
              throw new Error('Failed to extract Motion Photo video')
            }
          }
          else if (videoSource.type === 'live-photo') {
            // Live Photo: 处理独立视频文件
            if (needsVideoConversion(videoSource.videoUrl)) {
              const result = await this.convertVideo(videoSource.videoUrl, videoElement, callbacks)
              resolve(result)
            }
            else {
              const result = await this.loadDirectVideo(videoSource.videoUrl, videoElement)
              resolve(result)
            }
          }
          else {
            // type === 'none'
            throw new Error('No video source provided')
          }
        }
        catch (error) {
          console.error('Failed to process video:', error)
          onLoadingStateUpdate?.({
            isVisible: false,
          })
          reject(error)
        }
      }

      // 异步处理视频，不阻塞图片显示
      processVideo()
    })
  }

  private async processImageBlob(blob: Blob, originalUrl: string, request: SharedImageLoad): Promise<ImageCacheResult> {
    const callbacks: LoadingCallbacks = {
      onLoadingStateUpdate: state => updateSharedLoadingState(request, state),
    }

    try {
      // 使用策略模式检测并转换图像
      const conversionResult = await imageConverterManager.convertImage(blob, originalUrl, callbacks)

      if (conversionResult) {
        // 需要转换的格式
        return {
          blobSrc: conversionResult.url,
          convertedUrl: conversionResult.url,
          format: conversionResult.format,
          originalSize: conversionResult.originalSize,
          retainedSize: conversionResult.convertedSize,
        }
      }
      else {
        // 不需要转换的普通图片
        return this.processRegularImage(blob)
      }
    }
    catch (conversionError) {
      console.error('Image conversion failed:', conversionError)

      // 转换失败时，尝试按普通图片处理
      try {
        return this.processRegularImage(blob)
      }
      catch (fallbackError) {
        console.error('Fallback to regular image processing also failed:', fallbackError)
        throw conversionError
      }
    }
  }

  private processRegularImage(blob: Blob): ImageCacheResult {
    const url = URL.createObjectURL(blob)

    return {
      blobSrc: url,
      format: blob.type,
      originalSize: blob.size,
      retainedSize: blob.size,
    }
  }

  private async convertVideo(
    livePhotoVideoUrl: string,
    videoElement: HTMLVideoElement,
    callbacks: LoadingCallbacks,
  ): Promise<VideoProcessResult> {
    const { onLoadingStateUpdate } = callbacks

    // 更新加载指示器显示转换进度
    onLoadingStateUpdate?.({
      isVisible: true,
      isConverting: true,
      loadingProgress: 0,
    })

    const i18n = jotaiStore.get(i18nAtom)

    const result = await convertMovToMp4(livePhotoVideoUrl, (progress) => {
      // 检查是否包含编码器信息（支持多语言）
      const codecKeywords: string[] = [
        i18n.t('video.codec.keyword'), // 翻译键
        'encoder',
        'codec',
        '编码器', // 备用关键词
      ]
      const isCodecInfo = codecKeywords.some((keyword: string) =>
        progress.message.toLowerCase().includes(keyword.toLowerCase()))

      onLoadingStateUpdate?.({
        isVisible: true,
        isConverting: progress.isConverting,
        loadingProgress: progress.progress,
        conversionMessage: progress.message,
        codecInfo: isCodecInfo ? progress.message : undefined,
      })
    })

    if (result.success && result.videoUrl) {
      const convertedVideoUrl = result.videoUrl

      videoElement.src = result.videoUrl
      videoElement.load()

      onLoadingStateUpdate?.({
        isVisible: false,
      })

      return new Promise((resolve) => {
        const handleVideoCanPlay = () => {
          videoElement.removeEventListener('canplaythrough', handleVideoCanPlay)
          resolve({
            convertedVideoUrl,
          })
        }

        videoElement.addEventListener('canplaythrough', handleVideoCanPlay)
      })
    }
    else {
      console.error('Video conversion failed:', result.error)
      onLoadingStateUpdate?.({
        isVisible: false,
      })
      throw new Error(result.error || 'Video conversion failed')
    }
  }

  private async loadDirectVideo(
    livePhotoVideoUrl: string,
    videoElement: HTMLVideoElement,
  ): Promise<VideoProcessResult> {
    // 直接使用原始视频
    videoElement.src = livePhotoVideoUrl
    videoElement.load()

    return new Promise((resolve) => {
      const handleVideoCanPlay = () => {
        videoElement.removeEventListener('canplaythrough', handleVideoCanPlay)
        resolve({
          conversionMethod: '',
        })
      }

      videoElement.addEventListener('canplaythrough', handleVideoCanPlay)
    })
  }

  cleanup() {
    this.detachImageLoad()
  }

  private detachImageLoad() {
    const activeLoad = this.activeImageLoad
    if (!activeLoad) {
      return
    }

    const { callbacks, request } = activeLoad
    request.callbacks.delete(callbacks)
    this.activeImageLoad = null

    if (!request.settled && !request.downloadComplete && request.callbacks.size === 0) {
      request.cancelled = true
      request.settled = true
      if (inFlightImageLoads.get(activeLoad.src) === request) {
        inFlightImageLoads.delete(activeLoad.src)
      }
      request.reject(createAbortError())
      request.xhr.abort()
    }
  }
}

// Image cache management functions
export function getImageCacheSize(): number {
  return imageCache.size()
}

export function clearImageCache(): void {
  imageCache.clear()
}

export function removeImageCache(cacheKey: string): boolean {
  return imageCache.delete(cacheKey)
}

export function getImageCacheStats(): {
  size: number
  maxSize: number
  keys: string[]
} {
  return imageCache.getStats()
}

/**
 * 根据原始 URL 移除特定的图片缓存项
 */
export function removeImageCacheByUrl(originalUrl: string): boolean {
  return imageCache.delete(originalUrl)
}
