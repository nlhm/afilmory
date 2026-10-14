# Private gallery image loading

Updated: 2026-10-14.

The gallery uses three image sizes: a 600px thumbnail for the grid, a JPEG preview with a maximum edge of 2048px for browsing, and the original for detailed zoom, HDR output, and downloads.

The builder writes previews to `apps/web/public/previews/<photoId>.jpg`. Vite copies these into its output, and the SSR build copies that output into `apps/ssr/public`. Previews therefore ship with the Vercel deployment, alongside thumbnails. They are protected by the same gallery session middleware and use `private, max-age=31536000, immutable` with a content digest in the URL. Original media remains in R2 and is accessed using short-lived signed URLs.

An incremental manifest build automatically processes photos with missing preview metadata or files. Preview content changes produce a separate `previewDigest`; refreshing a photo must invalidate the preview as well as the thumbnail and original. `--force-thumbnails` also regenerates previews. A deployment must run the manifest builder before packaging static assets.

The viewer loads the preview first and requests the original when the user zooms. On HDR-capable displays, HDR photos also load the original after the preview is available. Downloads use the original URL until the original Blob is loaded. Adjacent-photo preloading targets previews, with two concurrent tasks and a preference for the navigation direction. Changing resolution preserves the viewport.

Shared image loads have independent consumer subscriptions. Cancelling a preload releases only its subscription; an active viewer can keep the download alive. The underlying request is cancelled when its last consumer leaves. Persistent cache hits return immediately and update LRU metadata asynchronously.

Validation should cover slow original responses, adjacent-photo navigation, zoom promotion without a viewport jump, failed originals with a usable preview, portrait orientation, digest invalidation, unauthorized preview requests, and original downloads. Cache and scheduling regression tests live under `apps/web/src/lib`; image encoding tests live under `packages/builder/src/image`; access tests live under `apps/ssr/src/lib/gallery-access`.

The viewer upgrade incorporates upstream commit `215576e7` (WebGPU rendering and JPEG gain-map HDR). WebGPU initialization or device loss falls back to WebGL. A stable photo resource identifier allows the viewport to survive preview-to-original promotion as well as renderer fallback. Upstream `a3db486b` adds fit/fill/100% double-tap cycling, and `9a0413dd` prevents pinch gestures from starting Live Photo playback. Pending long-press timers are also cancelled on unmount and touch cancellation.

HEIC conversion incorporates upstream commit `daf774bf`. On browsers requiring conversion, supported HEIF grids use WebCodecs with a preference for hardware decoding. Unsupported layouts, browser APIs, codecs, or decode failures fall back to libheif. A supported Apple HDR auxiliary is decoded separately and passed to the WebGPU renderer; an unavailable auxiliary leaves the SDR base usable. Converted-image cache entries retain the base and gain-map URLs together and release both when removed. Native Safari HEIC handling remains in use where conversion is unnecessary.

HEIF parser tests cover tile ordering, rotation, edge crop, and malformed or unsupported inputs. Mocked browser API tests cover decoder failure cleanup and optional HDR auxiliaries. These verify control flow, not device decoding speed or HDR appearance; real HEIC photos and capable devices are needed to assess those.

SSR thumbnail fallback adapts upstream `c8e331df`: authenticated OG requests fall back after a backend connection failure or 5xx response. The redirect uses a relative `/thumbnails/` location, retains private caching and noindex headers, and requires a gallery session. A relative location also avoids leaking Next.js's internal hostname. Backend 4xx responses retain their status.

The upstream prebuilt-manifest fetch command (`0ca1c754`) is not included. It fetches a public manifest into a different directory and does not fetch the thumbnail/preview assets required by this private deployment. The current build still uses the builder and its existing storage configuration. Mobile, marketing-site, billing, and broad dependency upgrades are outside this gallery loading change.

Validation on 2026-10-14: 77 relevant tests passed and one optional real Xiaomi HDR fixture test was skipped. Web, viewer, and SSR TypeScript checks passed, as did frozen dependency installation, the viewer build, and Vite-to-Next production compilation with three synthetic photos. The production parser suite includes a generated paired-JPEG test; its real-photo test runs when `photos/IMG_20251111_002156.jpg` is available.

An Edge browser check used the production SSR app and a local simulated S3 endpoint. Ordinary browsing made no original-media request. Zoom triggered the original request; during a five-second delay the preview stayed visible, and the view stayed in place when the original arrived. A simulated 503 retained the zoomed preview and showed a preview-specific error message. Context-menu download while displaying a preview produced a file byte-identical to the original. HTTP checks confirmed preview and OG endpoints reject unauthenticated requests and authenticated previews use private immutable caching. These checks cover desktop WebGPU and synthetic JPEGs. Actual R2 deployment, mobile touch gestures, native HEIC decoding speed, HDR output on capable displays, and renderer device-loss recovery still need device/environment validation.
