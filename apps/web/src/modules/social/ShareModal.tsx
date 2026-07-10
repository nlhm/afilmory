import type { ModalComponent } from '@afilmory/ui'
import { Modal } from '@afilmory/ui'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { canShareImageFile, createImageShareFile, isIOSDevice, isShareCancelled } from '~/lib/share-image'
import type { PhotoManifest } from '~/types/photo'

interface ShareModalTriggerProps {
  photo: PhotoManifest
  trigger: ReactNode
  blobSrc?: string
}

interface ShareSheetProps {
  photo: PhotoManifest
  blobSrc?: string
}

export const ShareModal = ({ photo, trigger, blobSrc }: ShareModalTriggerProps) => {
  const handleOpen = useCallback(() => {
    Modal.present(ShareSheet, { photo, blobSrc }, { dismissOnOutsideClick: true })
  }, [blobSrc, photo])

  if (isValidElement(trigger)) {
    return cloneElement(trigger as ReactElement, {
      // @ts-expect-error - onClick is not a valid prop for the trigger element
      onClick: (event: MouseEvent<HTMLElement>) => {
        // @ts-expect-error - trigger is a valid React element
        trigger.props?.onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        handleOpen()
      },
    })
  }

  return (
    <button type="button" onClick={handleOpen} className="contents">
      {trigger}
    </button>
  )
}

const ShareSheet: ModalComponent<ShareSheetProps> = ({ photo, blobSrc, dismiss }) => {
  const { t } = useTranslation()
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const shouldShareOriginalOnIOS = canUseNativeShare && isIOSDevice()
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false)
  const [isPreparingShareFile, setIsPreparingShareFile] = useState(shouldShareOriginalOnIOS)
  const [shareFile, setShareFile] = useState<File | null>(null)

  const shareTitle = photo.title || t('photo.share.default.title')

  useEffect(() => {
    if (!shouldShareOriginalOnIOS) {
      return
    }

    const controller = new AbortController()
    setIsPreparingShareFile(true)
    setShareFile(null)

    void createImageShareFile(blobSrc || photo.originalUrl, {
      fallbackName: photo.id,
      format: photo.format,
      sourceKey: photo.s3Key,
      signal: controller.signal,
    })
      .then((file) => {
        if (canShareImageFile(file)) {
          setShareFile(file)
        }
      })
      .catch((error: unknown) => {
        if (!isShareCancelled(error)) {
          console.warn('Unable to prepare image for sharing:', error)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsPreparingShareFile(false)
        }
      })

    return () => controller.abort()
  }, [blobSrc, photo.format, photo.id, photo.originalUrl, photo.s3Key, shouldShareOriginalOnIOS])

  const canSaveToPhotos = shouldShareOriginalOnIOS && shareFile !== null
  const isPreparingSaveToPhotos = shouldShareOriginalOnIOS && isPreparingShareFile

  const handleDownloadOriginal = useCallback(async () => {
    try {
      setIsDownloadingOriginal(true)

      if (canSaveToPhotos && shareFile) {
        await navigator.share({ files: [shareFile] })
        dismiss()
        return
      }

      const file = await createImageShareFile(photo.originalUrl, {
        fallbackName: photo.id,
        format: photo.format,
        sourceKey: photo.s3Key,
      })
      downloadFile(file)
      toast.success(t('photo.share.download.original'))
    }
    catch (error) {
      if (!isShareCancelled(error)) {
        toast.error(t('photo.share.download.failed'))
      }
    }
    finally {
      setIsDownloadingOriginal(false)
    }
  }, [canSaveToPhotos, dismiss, photo.format, photo.id, photo.originalUrl, photo.s3Key, shareFile, t])

  const actionLabel = canSaveToPhotos ? t('photo.share.saveToPhotos') : t('photo.share.download.original')

  return (
    <div className="w-full text-base">
      <div className="mb-4 min-w-0">
        <div className="truncate text-lg font-semibold text-white">{shareTitle}</div>
        {photo.location?.city && <p className="mt-0.5 text-xs text-white/40">{photo.location.city}</p>}
      </div>

      <button
        type="button"
        className="glassmorphic-btn flex w-full items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={handleDownloadOriginal}
        disabled={isDownloadingOriginal || isPreparingSaveToPhotos}
        title={actionLabel}
      >
        <i className={canSaveToPhotos ? 'i-mingcute-pic-line text-lg' : 'i-mingcute-download-3-line text-lg'} />
        <span>{isDownloadingOriginal || isPreparingSaveToPhotos ? '…' : actionLabel}</span>
      </button>
    </div>
  )
}

ShareSheet.contentClassName = 'max-w-sm w-full z-1000000'

function downloadFile(file: File) {
  const blobUrl = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

ShareSheet.displayName = 'ShareSheet'
