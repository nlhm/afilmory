# Private gallery image loading

Updated: 2026-10-13.

The gallery uses three image sizes: a 600px thumbnail for the grid, a JPEG preview with a maximum edge of 2048px for browsing, and the original for detailed zoom, HDR output, and downloads.

The builder writes previews to `apps/web/public/previews/<photoId>.jpg`. Vite copies these into its output, and the SSR build copies that output into `apps/ssr/public`. Previews therefore ship with the Vercel deployment, alongside thumbnails. They are protected by the same gallery session middleware and use `private, max-age=31536000, immutable` with a content digest in the URL. Original media remains in R2 and is accessed using short-lived signed URLs.

An incremental manifest build automatically processes photos with missing preview metadata or files. Preview content changes produce a separate `previewDigest`; refreshing a photo must invalidate the preview as well as the thumbnail and original. `--force-thumbnails` also regenerates previews. A deployment must run the manifest builder before packaging static assets.

The viewer loads the preview first and requests the original when the user zooms. On HDR-capable displays, HDR photos also load the original after the preview is available. Downloads use the original URL until the original Blob is loaded. Adjacent-photo preloading targets previews, with two concurrent tasks and a preference for the navigation direction. Changing resolution preserves the viewport.

Shared image loads have independent consumer subscriptions. Cancelling a preload releases only its subscription; an active viewer can keep the download alive. The underlying request is cancelled when its last consumer leaves. Persistent cache hits return immediately and update LRU metadata asynchronously.

Validation should cover slow original responses, adjacent-photo navigation, zoom promotion without a viewport jump, failed originals with a usable preview, portrait orientation, digest invalidation, unauthorized preview requests, and original downloads. Cache and scheduling regression tests live under `apps/web/src/lib`; image encoding tests live under `packages/builder/src/image`; access tests live under `apps/ssr/src/lib/gallery-access`.
