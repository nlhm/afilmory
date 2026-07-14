import { heicTo, isHeic } from 'heic-to'

import { i18nAtom } from '~/i18n'
import { isSafari } from '~/lib/device-viewport'
import type { LoadingCallbacks } from '~/lib/image-loader-manager'
import { jotaiStore } from '~/lib/jotai'

import type { ConversionResult, ImageConverterStrategy } from '../type'

// HEIC 转换策略
export class HeicConverterStrategy implements ImageConverterStrategy {
  getName(): string {
    return 'HEIC'
  }

  getSupportedFormats(): string[] {
    return ['image/heic', 'image/heif']
  }

  async shouldConvert(_blob: Blob): Promise<boolean> {
    try {
      // 只需检查浏览器是否支持，格式检测已由 file-type 完成
      return !isBrowserSupportHeic()
    }
    catch (error) {
      console.error('HEIC browser support detection failed:', error)
      return false
    }
  }

  async convert(blob: Blob, originalUrl: string, callbacks?: LoadingCallbacks): Promise<ConversionResult> {
    const { onLoadingStateUpdate } = callbacks || {}

    try {
      // 获取国际化文案
      const i18n = jotaiStore.get(i18nAtom)

      // 更新转换状态
      onLoadingStateUpdate?.({
        isConverting: true,
        isQueueWaiting: false,
        conversionMessage: i18n.t('loading.heic.converting'),
        isHeicFormat: true,
        loadingProgress: 100,
        loadedBytes: blob.size,
        totalBytes: blob.size,
      })

      const result = await convertHeicImage(blob, originalUrl)

      return {
        url: result.url,
        convertedSize: result.convertedSize,
        format: result.format,
        originalSize: result.originalSize,
      }
    }
    catch (error) {
      console.error('HEIC conversion failed:', error)
      throw new Error(`HEIC conversion failed: ${error}`)
    }
  }
}

export interface HeicConversionOptions {
  quality?: number
  format?: 'image/jpeg' | 'image/png'
}

/**
 * 检测文件是否为 HEIC/HEIF 格式
 */
export async function detectHeicFormat(file: File | Blob): Promise<boolean> {
  try {
    return await isHeic(file as File)
  }
  catch (error) {
    console.warn('Failed to detect HEIC format:', error)
    return false
  }
}

export const isBrowserSupportHeic = () => {
  const safariVersionMatch = navigator.userAgent.match(/version\/(\d+)/i)
  const versionString = safariVersionMatch?.[1]
  const version = versionString ? Number.parseInt(versionString, 10) : 0

  return isSafari && version >= 17
}

/**
 * 将 HEIC/HEIF 图片转换为 JPEG 或 PNG（支持缓存）
 */
export async function convertHeicImage(
  file: File | Blob,
  _src: string,
  options: HeicConversionOptions = {},
): Promise<ConversionResult> {
  const { quality = 1, format = 'image/jpeg' } = options

  try {
    // 检查是否为 HEIC 格式
    const isHeicFormat = await detectHeicFormat(file)
    if (!isHeicFormat) {
      throw new Error('File is not in HEIC/HEIF format')
    }

    // 转换图片
    const convertedBlob = await heicTo({
      blob: file,
      type: format,
      quality,
    })

    // 创建 URL
    const url = URL.createObjectURL(convertedBlob)

    const result: ConversionResult = {
      url,
      originalSize: file.size,
      convertedSize: convertedBlob.size,
      format,
    }

    return result
  }
  catch (error) {
    console.error('HEIC conversion failed:', error)
    throw new Error(`Failed to convert HEIC image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 清理转换后的 URL
 */
export function revokeConvertedUrl(url: string): void {
  try {
    URL.revokeObjectURL(url)
  }
  catch (error) {
    console.warn('Failed to revoke URL:', error)
  }
}
