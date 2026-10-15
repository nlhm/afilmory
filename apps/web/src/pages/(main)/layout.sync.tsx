import { ScrollArea, ScrollElementContext } from '@afilmory/ui'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { Outlet, useSearchParams } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { siteConfig } from '~/config'
import { useMobile } from '~/hooks/useMobile'
import { usePhotos } from '~/hooks/usePhotoViewer'
import { normalizeDateRange } from '~/modules/gallery/dateRangeUtils'
import { PhotosRoot } from '~/modules/gallery/PhotosRoot'
import { ViewerRouteSync } from '~/modules/viewer/ViewerRouteSync'
import { PhotosProvider } from '~/providers/photos-provider'

export const Component = () => {
  useSyncGallerySettingsWithUrl()

  const isMobile = useMobile()
  const photos = usePhotos()

  return (
    <>
      <PhotosProvider photos={photos}>
        <ViewerRouteSync />
        {siteConfig.accentColor && (
          <style
            dangerouslySetInnerHTML={{
              __html: `
          :root:has(input.theme-controller[value=dark]:checked), [data-theme="dark"] {
            --color-primary: ${siteConfig.accentColor};
            --color-accent: ${siteConfig.accentColor};
            --color-secondary: ${siteConfig.accentColor};
          }
          `,
            }}
          />
        )}

        {isMobile ? (
          <ScrollElementContext value={document.body}>
            <PhotosRoot />
          </ScrollElementContext>
        ) : (
          <ScrollArea rootClassName="h-svh w-full" viewportClassName="size-full" scrollbarClassName="mt-12">
            <PhotosRoot />
          </ScrollArea>
        )}

        <Outlet />
      </PhotosProvider>
    </>
  )
}

/**
 * Sync gallery filter settings (tags, cameras, lenses, ratings) with URL search params.
 * This is bidirectional:
 * - On initial load: restore state from URL
 * - On state change: update URL
 * - On URL change (back/forward): update state
 */
const useSyncGallerySettingsWithUrl = () => {
  const setGallerySetting = useSetAtom(gallerySettingAtom)
  const { selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange, tagFilterMode }
    = useAtomValue(gallerySettingAtom)
  const [searchParams, setSearchParams] = useSearchParams()

  // Track if initial restore is done
  const isInitializedRef = useRef(false)
  // Track the last URL we synced from to detect external URL changes
  const lastSyncedUrlRef = useRef<string>('')
  // Track if we're currently updating URL (to prevent loops)
  const isUpdatingUrlRef = useRef(false)

  // Restore state from URL on mount and when URL changes externally (back/forward)
  useEffect(() => {
    const currentUrl = searchParams.toString()

    // Skip if we just updated the URL ourselves
    if (isUpdatingUrlRef.current) {
      isUpdatingUrlRef.current = false
      return
    }

    // Skip if URL hasn't changed from what we last synced
    if (isInitializedRef.current && currentUrl === lastSyncedUrlRef.current) {
      return
    }

    lastSyncedUrlRef.current = currentUrl

    const tagsFromSearchParams = searchParams.get('tags')?.split(',')
    const camerasFromSearchParams = searchParams.get('cameras')?.split(',')
    const lensesFromSearchParams = searchParams.get('lenses')?.split(',')
    const ratingsFromSearchParams = searchParams.get('rating') ? Number(searchParams.get('rating')) : null
    const tagModeFromSearchParams = searchParams.get('tag_mode') as 'union' | 'intersection' | null
    const dateRangeFromSearchParams = normalizeDateRange(searchParams.get('from'), searchParams.get('to'))

    // Always update state from URL (URL is source of truth for filters)
    setGallerySetting(prev => ({
      ...prev,
      selectedTags: tagsFromSearchParams || [],
      selectedCameras: camerasFromSearchParams || [],
      selectedLenses: lensesFromSearchParams || [],
      selectedRatings: ratingsFromSearchParams,
      selectedDateRange: dateRangeFromSearchParams,
      tagFilterMode: tagModeFromSearchParams || 'union',
    }))

    isInitializedRef.current = true
  }, [searchParams, setGallerySetting])

  // Sync state changes to URL
  useEffect(() => {
    // Wait for initial restore before syncing state to URL
    if (!isInitializedRef.current) {
      return
    }

    const tags = selectedTags.join(',')
    const cameras = selectedCameras.join(',')
    const lenses = selectedLenses.join(',')
    const rating = selectedRatings?.toString() ?? ''
    const tagMode = tagFilterMode === 'union' ? '' : tagFilterMode
    const fromParam = selectedDateRange?.from ?? ''
    const toParam = selectedDateRange?.to ?? ''

    setSearchParams(
      (currentParams) => {
        const currentTags = currentParams.get('tags') || ''
        const currentCameras = currentParams.get('cameras') || ''
        const currentLenses = currentParams.get('lenses') || ''
        const currentRating = currentParams.get('rating') || ''
        const currentTagMode = currentParams.get('tag_mode') || ''
        const currentFrom = currentParams.get('from') || ''
        const currentTo = currentParams.get('to') || ''

        // Check if anything has changed
        if (
          currentTags === tags
          && currentCameras === cameras
          && currentLenses === lenses
          && currentRating === rating
          && currentTagMode === tagMode
          && currentFrom === fromParam
          && currentTo === toParam
        ) {
          return currentParams
        }

        // Mark that we're updating URL to prevent loop
        isUpdatingUrlRef.current = true

        const newer = new URLSearchParams(currentParams)

        if (tags) {
          newer.set('tags', tags)
        }
        else {
          newer.delete('tags')
        }

        if (cameras) {
          newer.set('cameras', cameras)
        }
        else {
          newer.delete('cameras')
        }

        if (lenses) {
          newer.set('lenses', lenses)
        }
        else {
          newer.delete('lenses')
        }

        if (rating) {
          newer.set('rating', rating)
        }
        else {
          newer.delete('rating')
        }

        if (tagMode) {
          newer.set('tag_mode', tagMode)
        }
        else {
          newer.delete('tag_mode')
        }

        if (fromParam) {
          newer.set('from', fromParam)
        }
        else {
          newer.delete('from')
        }

        if (toParam) {
          newer.set('to', toParam)
        }
        else {
          newer.delete('to')
        }

        // Update last synced URL
        lastSyncedUrlRef.current = newer.toString()

        return newer
      },
      { replace: true },
    ) // Use replace to avoid polluting history for filter changes
  }, [
    selectedTags,
    selectedCameras,
    selectedLenses,
    selectedRatings,
    selectedDateRange,
    tagFilterMode,
    setSearchParams,
  ])
}
