# Private gallery image loading

Updated: 2026-10-15.

The gallery uses three image sizes: a 600px thumbnail for the grid, a JPEG preview with a maximum edge of 2048px for browsing, and the original for detailed zoom, HDR output, and downloads.

The builder writes previews to `apps/web/public/previews/<photoId>.jpg`. Vite copies these into its output, and the SSR build copies that output into `apps/ssr/public`. Previews therefore ship with the Vercel deployment, alongside thumbnails. They are protected by the same gallery session middleware and use `private, max-age=31536000, immutable` with a content digest in the URL. Original media remains in R2 and is accessed using short-lived signed URLs.

An incremental manifest build automatically processes photos with missing preview metadata or files. Preview content changes produce a separate `previewDigest`; refreshing a photo must invalidate the preview as well as the thumbnail and original. `--force-thumbnails` also regenerates previews. A deployment must run the manifest builder before packaging static assets.

The viewer loads the preview first and requests the original when the displayed image needs more physical pixels than the preview provides. It uses the viewport scale and device pixel ratio, allows an 8% margin, and waits 150ms before starting a request. Returning below the threshold or leaving the photo cancels a pending request. Small zooms can therefore stay on the preview, while a large high-density display can request the original at fit. On HDR-capable displays, HDR photos also load the original after the preview is available. Downloads use the original URL until the original Blob is loaded. Adjacent-photo preloading targets previews, with two concurrent tasks and a preference for the navigation direction. Changing resolution preserves the viewport. The double-tap 100% stage and scale indicator use original dimensions even while a preview is displayed.

Shared image loads have independent consumer subscriptions. Cancelling a preload releases only its subscription; an active viewer can keep the download alive. The underlying request is cancelled when its last consumer leaves. Persistent cache hits return immediately and update LRU metadata asynchronously.

Validation should cover slow original responses, adjacent-photo navigation, zoom promotion without a viewport jump, failed originals with a usable preview, portrait orientation, digest invalidation, unauthorized preview requests, and original downloads. Cache and scheduling regression tests live under `apps/web/src/lib`; image encoding tests live under `packages/builder/src/image`; access tests live under `apps/ssr/src/lib/gallery-access`.

The viewer upgrade incorporates upstream commit `215576e7` (WebGPU rendering and JPEG gain-map HDR). WebGPU initialization or device loss falls back to WebGL. A stable photo resource identifier allows the viewport to survive preview-to-original promotion as well as renderer fallback. Upstream `a3db486b` adds fit/fill/100% double-tap cycling, and `9a0413dd` prevents pinch gestures from starting Live Photo playback. Pending long-press timers are also cancelled on unmount and touch cancellation.

HEIC conversion incorporates upstream commit `daf774bf`. On browsers requiring conversion, supported HEIF grids use WebCodecs with a preference for hardware decoding. Unsupported layouts, browser APIs, codecs, or decode failures fall back to libheif. A supported Apple HDR auxiliary is decoded separately and passed to the WebGPU renderer; an unavailable auxiliary leaves the SDR base usable. Converted-image cache entries retain the base and gain-map URLs together and release both when removed. Native Safari HEIC handling remains in use where conversion is unnecessary.

HEIF parser tests cover tile ordering, rotation, edge crop, and malformed or unsupported inputs. Mocked browser API tests cover decoder failure cleanup and optional HDR auxiliaries. These verify control flow, not device decoding speed or HDR appearance; real HEIC photos and capable devices are needed to assess those.

SSR thumbnail fallback adapts upstream `c8e331df`: authenticated OG requests fall back after a backend connection failure or 5xx response. The redirect uses a relative `/thumbnails/` location, retains private caching and noindex headers, and requires a gallery session. A relative location also avoids leaking Next.js's internal hostname. Backend 4xx responses retain their status.

The upstream prebuilt-manifest fetch command (`0ca1c754`) is not included. It fetches a public manifest into a different directory and does not fetch the thumbnail/preview assets required by this private deployment. The current build still uses the builder and its existing storage configuration. Mobile, marketing-site, billing, and broad dependency upgrades are outside this gallery loading change.

Validation on 2026-10-14: 77 relevant tests passed and one optional real Xiaomi HDR fixture test was skipped. Web, viewer, and SSR TypeScript checks passed, as did frozen dependency installation, the viewer build, and Vite-to-Next production compilation with three synthetic photos. The production parser suite includes a generated paired-JPEG test; its real-photo test runs when `photos/IMG_20251111_002156.jpg` is available.

An Edge browser check used the production SSR app and a local simulated S3 endpoint. Ordinary browsing made no original-media request. Zoom triggered the original request; during a five-second delay the preview stayed visible, and the view stayed in place when the original arrived. A simulated 503 retained the zoomed preview and showed a preview-specific error message. Context-menu download while displaying a preview produced a file byte-identical to the original. HTTP checks confirmed preview and OG endpoints reject unauthenticated requests and authenticated previews use private immutable caching. These checks cover desktop WebGPU and synthetic JPEGs. Actual R2 deployment, mobile touch gestures, native HEIC decoding speed, HDR output on capable displays, and renderer device-loss recovery still need device/environment validation.

Investigation on 2026-10-15 found a separate cause of perceived zoom stutter: a quickly available original could replace the preview resource while its zoom animation was still running. The old renderer was destroyed mid-animation, leaving the view at an intermediate scale until the replacement loaded. Same-photo resource promotion now waits for the renderer to finish animation, dragging, or pinching. Idle viewers promote immediately, different photos switch immediately, and pending promotions are cancelled when superseded or unmounted.

A temporary probe in an Edge production build confirmed the baseline destroyed the renderer with its animation still active; after the fix destruction occurred after animation completion and fit-to-fill reached its target. Both synthetic runs had frame intervals below 25ms, so these measurements establish an animation interruption rather than a measured main-thread long task on that machine. Three scheduling regression tests cover waiting, immediate idle promotion, and cancellation. Temporary probes and synthetic fixtures are excluded from the final change.

## Browser diagnostics

Open the deployed gallery with `?viewerDiagnostics=1`, for example `https://your-gallery.example/?viewerDiagnostics=1`, then open a photo. Expand the **Viewer diagnostics / 看图诊断** control at the bottom left. Initialization happens at SPA startup, so recording stays enabled during client-side navigation. Reloading without the query parameter disables it.

The panel shows the latest 16 events; **Export report / 导出报告** downloads up to 160 events with browser, viewport, HDR capability and build-commit information. Records remain in the current page's memory and are never automatically sent to a server. Another browser cannot retrieve your session's measurements; export and share a report to investigate a device-specific issue. Resource identifiers retain paths but omit hosts, credentials, query parameters and Blob URLs. Paths can still identify photos.

Event meanings:

- `cache-read`: application persistent-cache lookup and Blob read. `cache: persistent` is a hit; `http` means acquisition proceeds through HTTP.
- `download`: XHR response-body acquisition, including redirects. An HTTP acquisition can hit the browser's own HTTP cache; `cache: http` does not prove a network transfer. `bytes` is Blob size, not compressed transfer size.
- `format-processing`: format detection and optional conversion before passing the Blob to the renderer. This is not necessarily native browser decoding time.
- `load`: one consumer's load time, including shared-request waiting, or an application memory-cache hit.
- `renderer-image`: renderer initialization, worker startup, Blob read, decoding and overview preparation until texture preparation begins. These parts are grouped rather than individually timed.
- `texture-prepare`: texture preparation until the engine reports ready. WebGPU includes submitted-work completion; WebGL records CPU submission. This is not a portable GPU-only timer.
- `renderer-ready`: total renderer setup/load time, including restoration of the saved viewport. It does not assert the exact time pixels appeared on the physical display.
- `renderer-error`: failed renderer attempt; a WebGPU failure may subsequently recover through WebGL.
- `promotion-wait`: time a resource replacement waited for the current interaction to finish.
- `original-request`: resolution or HDR promotion reason. Resolution requests include required physical-pixel dimensions and available preview dimensions.
- `frame-gap`: a visible-tab animation-frame interval over 34ms; hidden-tab transitions reset its clock. Browser scheduling and diagnostic/automation overhead can also contribute.
- `long-task`: a browser-reported main-thread task, where the Long Tasks API is supported. Unsupported browsers still report frame gaps.

Times overlap and should not be added together. Diagnostics are off during ordinary browsing; frame monitoring runs only while the viewer is open in an explicitly enabled session. Run the diagnostics and resolution-policy regression tests with `pnpm --filter @afilmory/web test:viewer`.

Validation on 2026-10-15 used a production Vite-to-Next build, synthetic JPEGs, Edge, and a simulated S3 endpoint. At a 390×844 viewport, opening the photo and the first double-click to fill made no original request; the second double-click requested the original at its native dimensions. The report recorded the simulated original download at approximately 1.55 seconds, and its JSON export was validated. At the default desktop high-density viewport, fit required 2283×1712 physical pixels, correctly triggering promotion beyond the 2048×1536 preview. An earlier visit also confirmed a persistent original-cache hit. These are local synthetic checks; actual Vercel/R2 latency and device-specific HDR/HEIC performance require deployed-site validation.
