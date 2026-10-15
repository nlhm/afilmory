import { use, useEffect, useRef } from 'react'
import { useLocation, useMatch } from 'react-router'

import { getViewer, setViewer } from '~/atoms/viewer'
import { PhotoRouteBaseContext } from '~/providers/photos-context'

import { useContextPhotos } from './usePhotoViewer'

export const useSyncViewerWithUrl = () => {
  const location = useLocation()
  const photos = useContextPhotos()
  const routeBase = use(PhotoRouteBaseContext)
  const photoId = useMatch(`${routeBase}/photos/:photoId`)?.params.photoId

  const lastProcessedPathRef = useRef<string>('')

  useEffect(() => {
    const currentPath = location.pathname

    if (currentPath === lastProcessedPathRef.current) {
      return
    }

    lastProcessedPathRef.current = currentPath

    const isPhotoRoute = currentPath.startsWith(`${routeBase}/photos/`)
    const currentViewer = getViewer()

    if (isPhotoRoute && photoId) {
      const targetIndex = photos.findIndex(p => p.id === photoId)

      if (targetIndex !== -1 && (!currentViewer.isOpen || currentViewer.photoId !== photoId)) {
        setViewer(prev => ({
          ...prev,
          isOpen: true,
          openInstanceId: prev.isOpen ? prev.openInstanceId : prev.openInstanceId + 1,
          pendingCloseInstanceId: null,
          photoId,
          triggerElement: null,
        }))

        document.body.style.overflow = 'hidden'
      }
    }
    else {
      if (currentViewer.isOpen) {
        setViewer(prev => ({
          ...prev,
          isOpen: false,
          pendingCloseInstanceId: null,
          triggerElement: null,
        }))

        document.body.style.overflow = ''
      }
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [location.pathname, photoId, photos, routeBase])
}

export const useSyncViewerCloseShortcut = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      const currentViewer = getViewer()
      if (!currentViewer.isOpen || !currentViewer.openInstanceId) {
        return
      }
      if (currentViewer.pendingCloseInstanceId === currentViewer.openInstanceId) {
        return
      }

      event.preventDefault()

      setViewer((prev) => {
        if (!prev.isOpen || !prev.openInstanceId) {
          return prev
        }
        if (prev.pendingCloseInstanceId === prev.openInstanceId) {
          return prev
        }

        return {
          ...prev,
          pendingCloseInstanceId: prev.openInstanceId,
        }
      })
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
