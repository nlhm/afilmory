import * as React from 'react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import {
  defaultAlignmentAnimation,
  defaultDoubleClickConfig,
  defaultPanningConfig,
  defaultPinchConfig,
  defaultVelocityAnimation,
  defaultWheelConfig,
} from './constants'
import DebugInfoComponent from './DebugInfo'
import { LoadingState } from './enum'
import { afterViewerInteraction } from './interaction-idle'
import type {
  AppleGainMapSource,
  DebugInfo,
  ImageViewerOptions,
  ImageViewerRef,
  ImageViewportState,
  ViewerPerformanceEvent,
} from './interface'
import { WebGLImageViewerEngine } from './WebGLImageViewerEngine'
import { WebGPUImageViewerEngine } from './WebGPUImageViewerEngine'

export interface ImageViewerProps extends ImageViewerOptions {
  gainMapSource?: AppleGainMapSource
  alt?: string
  resourceId?: string
  onLoad?: () => void
  onError?: (error: Error) => void
  onHDRChange?: (hdr: boolean) => void
  onRendererChange?: (renderer: 'webgpu' | 'webgl') => void
  onPerformanceEvent?: (event: ViewerPerformanceEvent) => void
}

export const ImageViewer = ({
  ref,
  src,
  resourceId,
  gainMapSource,
  className = '',
  alt = '',
  onLoad,
  onError,
  onHDRChange,
  onRendererChange,
  onPerformanceEvent,
  width,
  height,
  originalWidth = 0,
  originalHeight = 0,
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  wheel = defaultWheelConfig,
  pinch = defaultPinchConfig,
  doubleClick = defaultDoubleClickConfig,
  panning = defaultPanningConfig,
  limitToBounds = true,
  centerOnInit = true,
  smooth = true,
  alignmentAnimation = defaultAlignmentAnimation,
  velocityAnimation = defaultVelocityAnimation,
  onZoomChange,
  onViewportChange,
  onImageCopied,
  onLoadingStateChange,
  debug = false,
  ...divProps
}: ImageViewerProps
  & Omit<React.HTMLAttributes<HTMLDivElement>, keyof ImageViewerProps> & {
    ref?: React.RefObject<ImageViewerRef | null>
  }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<WebGLImageViewerEngine | WebGPUImageViewerEngine | null>(null)
  const requestedResource = useMemo(
    () => ({ src, width, height, gainMapSource, id: resourceId ?? src }),
    [src, width, height, gainMapSource, resourceId],
  )
  const [displayedResource, setDisplayedResource] = useState(requestedResource)
  const activeResource = displayedResource.id === requestedResource.id ? displayedResource : requestedResource

  useEffect(() => {
    if (requestedResource === displayedResource) {
      return
    }
    const started = performance.now()
    return afterViewerInteraction(
      () => displayedResource.id === requestedResource.id && Boolean(viewerRef.current?.isInteracting()),
      () => {
        lifecycleRef.current.onPerformanceEvent?.({ stage: 'promotion-wait', durationMs: performance.now() - started })
        setDisplayedResource(requestedResource)
      },
    )
  }, [requestedResource, displayedResource])
  const [tileOutlineEnabled, setTileOutlineEnabled] = useState(false)
  const [renderer, setRenderer] = useState<'webgpu' | 'webgl'>(() =>
    typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'webgl')
  const savedViewportRef = useRef<{ src: string, viewport: ImageViewportState } | null>(null)
  const lifecycleRef = useRef({ onLoad, onError, onHDRChange, onRendererChange, onPerformanceEvent })
  lifecycleRef.current = { onLoad, onError, onHDRChange, onRendererChange, onPerformanceEvent }
  const loadingPhaseRef = useRef<{ stage: 'renderer-image' | 'texture-prepare', started: number } | null>(null)

  const setDebugInfoRef = useRef<(debugInfo: DebugInfo) => void>(() => {})
  const debugEnabled = Boolean(debug)

  const mergedWheel = useMemo(
    () => ({
      ...defaultWheelConfig,
      ...wheel,
    }),
    [wheel],
  )

  const mergedPinch = useMemo(
    () => ({
      ...defaultPinchConfig,
      ...pinch,
    }),
    [pinch],
  )

  const mergedDoubleClick = useMemo(
    () => ({
      ...defaultDoubleClickConfig,
      ...doubleClick,
    }),
    [doubleClick],
  )

  const mergedPanning = useMemo(
    () => ({
      ...defaultPanningConfig,
      ...panning,
    }),
    [panning],
  )

  const mergedAlignmentAnimation = useMemo(
    () => ({
      ...defaultAlignmentAnimation,
      ...alignmentAnimation,
    }),
    [alignmentAnimation],
  )

  const mergedVelocityAnimation = useMemo(
    () => ({
      ...defaultVelocityAnimation,
      ...velocityAnimation,
    }),
    [velocityAnimation],
  )

  const handleLoadingStateChange = useCallback(
    (loading: boolean, state?: LoadingState, quality?: 'high' | 'medium' | 'low' | 'unknown') => {
      if (lifecycleRef.current.onPerformanceEvent) {
        const phase
          = loading && state === LoadingState.IMAGE_LOADING
            ? 'renderer-image'
            : loading && state === LoadingState.CREATE_TEXTURE
              ? 'texture-prepare'
              : null
        const previous = loadingPhaseRef.current
        if (previous?.stage !== phase) {
          if (previous) {
            lifecycleRef.current.onPerformanceEvent({
              stage: previous.stage,
              durationMs: performance.now() - previous.started,
              renderer,
            })
          }
          loadingPhaseRef.current = phase ? { stage: phase, started: performance.now() } : null
        }
      }
      onLoadingStateChange?.(loading, state, quality)
    },
    [onLoadingStateChange, renderer],
  )

  const callbacksRef = useRef<
    Pick<Required<ImageViewerOptions>, 'onZoomChange' | 'onViewportChange' | 'onImageCopied' | 'onLoadingStateChange'>
  >({
    onZoomChange: onZoomChange || (() => {}),
    onViewportChange: onViewportChange || (() => {}),
    onImageCopied: onImageCopied || (() => {}),
    onLoadingStateChange: handleLoadingStateChange,
  })

  callbacksRef.current = {
    onZoomChange: onZoomChange || (() => {}),
    onViewportChange: onViewportChange || (() => {}),
    onImageCopied: onImageCopied || (() => {}),
    onLoadingStateChange: handleLoadingStateChange,
  }

  const interactionConfigRef = useRef<
    Pick<Required<ImageViewerOptions>, 'wheel' | 'pinch' | 'doubleClick' | 'panning'>
  >({
    wheel: mergedWheel,
    pinch: mergedPinch,
    doubleClick: mergedDoubleClick,
    panning: mergedPanning,
  })

  interactionConfigRef.current = {
    wheel: mergedWheel,
    pinch: mergedPinch,
    doubleClick: mergedDoubleClick,
    panning: mergedPanning,
  }

  useImperativeHandle(ref, () => ({
    zoomIn: (animated?: boolean) => viewerRef.current?.zoomIn(animated),
    zoomOut: (animated?: boolean) => viewerRef.current?.zoomOut(animated),
    resetView: () => viewerRef.current?.resetView(),
    getScale: () => viewerRef.current?.getScale() || 1,
  }))

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    let disposed = false
    const started = performance.now()
    let failed = false
    let engine: WebGLImageViewerEngine | WebGPUImageViewerEngine | null = null
    const fail = (reason: unknown) => {
      if (disposed || failed) {
        return
      }
      failed = true
      lifecycleRef.current.onPerformanceEvent?.({
        stage: 'renderer-error',
        durationMs: performance.now() - started,
        renderer,
      })
      const error = reason instanceof Error ? reason : new Error(String(reason))
      const viewport = engine?.getViewport()
      if (viewport && Number.isFinite(viewport.relativeScale) && viewport.imageWidth > 0) {
        savedViewportRef.current = { src: activeResource.id, viewport }
      }
      engine?.destroy()
      if (viewerRef.current === engine) {
        viewerRef.current = null
      }
      lifecycleRef.current.onHDRChange?.(false)
      if (renderer === 'webgpu') {
        console.warn('WebGPU viewer failed; falling back to WebGL', error)
        setRenderer('webgl')
      }
      else {
        callbacksRef.current.onLoadingStateChange(false)
        lifecycleRef.current.onError?.(error)
      }
    }
    const config: Required<ImageViewerOptions> = {
      src: activeResource.src,
      className: '',
      width: activeResource.width || 0,
      height: activeResource.height || 0,
      originalWidth,
      originalHeight,
      initialScale,
      minScale,
      maxScale,
      wheel: interactionConfigRef.current.wheel,
      pinch: interactionConfigRef.current.pinch,
      doubleClick: interactionConfigRef.current.doubleClick,
      panning: interactionConfigRef.current.panning,
      limitToBounds,
      centerOnInit,
      smooth,
      alignmentAnimation: mergedAlignmentAnimation,
      velocityAnimation: mergedVelocityAnimation,
      onZoomChange: callbacksRef.current.onZoomChange,
      onViewportChange: callbacksRef.current.onViewportChange,
      onImageCopied: callbacksRef.current.onImageCopied,
      onLoadingStateChange: callbacksRef.current.onLoadingStateChange,
      debug: debugEnabled,
    }
    try {
      engine
        = renderer === 'webgpu'
          ? new WebGPUImageViewerEngine(
              canvasRef.current,
              config,
              fail,
              (hdr) => {
                if (!disposed && !failed) {
                  lifecycleRef.current.onHDRChange?.(hdr)
                }
              },
              debugEnabled ? setDebugInfoRef : undefined,
            )
          : new WebGLImageViewerEngine(canvasRef.current, config, debugEnabled ? setDebugInfoRef : undefined)
      viewerRef.current = engine
      setTileOutlineEnabled(engine.isTileOutlineEnabled())
      const url = new URL(activeResource.src, document.baseURI).href
      void (
        engine instanceof WebGPUImageViewerEngine
          ? engine.loadImage(url, activeResource.width, activeResource.height, activeResource.gainMapSource)
          : engine.loadImage(url, activeResource.width, activeResource.height)
      )
        .then(() => {
          if (disposed || failed || !engine) {
            return
          }
          if (savedViewportRef.current?.src === activeResource.id) {
            engine.restoreViewport(savedViewportRef.current.viewport)
          }
          savedViewportRef.current = null
          lifecycleRef.current.onPerformanceEvent?.({
            stage: 'renderer-ready',
            durationMs: performance.now() - started,
            renderer,
            resourceWidth: engine.getViewport().imageWidth,
            resourceHeight: engine.getViewport().imageHeight,
          })
          lifecycleRef.current.onRendererChange?.(renderer)
          lifecycleRef.current.onHDRChange?.(
            renderer === 'webgpu' && engine instanceof WebGPUImageViewerEngine && engine.isHDR,
          )
          lifecycleRef.current.onLoad?.()
        })
        .catch(fail)
    }
    catch (error) {
      fail(error)
    }
    return () => {
      disposed = true
      loadingPhaseRef.current = null
      const viewport = engine?.getViewport()
      if (viewport && viewport.imageWidth > 0) {
        savedViewportRef.current = { src: activeResource.id, viewport }
      }
      engine?.destroy()
      if (viewerRef.current === engine) {
        viewerRef.current = null
      }
    }
  }, [
    renderer,
    activeResource,
    originalWidth,
    originalHeight,
    initialScale,
    minScale,
    maxScale,
    limitToBounds,
    centerOnInit,
    smooth,
    mergedAlignmentAnimation,
    mergedVelocityAnimation,
    debugEnabled,
  ])

  useEffect(() => {
    viewerRef.current?.updateCallbacks(callbacksRef.current)
  }, [onZoomChange, onViewportChange, onImageCopied, handleLoadingStateChange])

  useEffect(() => {
    viewerRef.current?.updateInteractionConfig(interactionConfigRef.current)
  }, [mergedWheel, mergedPinch, mergedDoubleClick, mergedPanning])

  const handleOutlineToggle = useCallback(
    (enabled: boolean) => {
      setTileOutlineEnabled(enabled)
      viewerRef.current?.setTileOutlineEnabled(enabled)
    },
    [setTileOutlineEnabled],
  )

  return (
    <div
      {...divProps}
      data-image-renderer={renderer}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...divProps.style,
      }}
    >
      <canvas
        key={renderer}
        ref={canvasRef}
        role="img"
        aria-label={alt || undefined}
        className={className}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          border: 'none',
          outline: 'none',
          margin: 0,
          padding: 0,
        }}
      />
      {debug && (
        <DebugInfoComponent
          outlineEnabled={tileOutlineEnabled}
          onToggleOutline={handleOutlineToggle}
          ref={(e) => {
            if (e) {
              setDebugInfoRef.current = e.updateDebugInfo
            }
          }}
        />
      )}
    </div>
  )
}
ImageViewer.displayName = 'ImageViewer'

export { type ImageViewerOptions, type ImageViewerRef } from './interface'
