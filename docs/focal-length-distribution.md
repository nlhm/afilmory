# Focal length distribution

The `/focal-lengths` page describes the actual focal lengths of the finished photos in the gallery manifest. Open it using the chart icon beside the search/view controls, or search for the page title in the command palette.

Statistics use EXIF `FocalLength`, retain decimal values for classification, and normalize equivalent representations such as `35`, `35.0` and `35 mm`. Missing, nonpositive, nonfinite or ambiguous values are excluded from percentages and listed separately. `FocalLengthIn35mmFormat` is never substituted. Shares are calculated against the photos with valid actual focal lengths in the currently selected lens scope, rather than against all published photos. This is a distribution of finished photos, not a shooting-frequency or keeper-rate measurement.

Photos are grouped around common prime focal lengths using fixed intervals. These are product-defined statistical bands, not an industry standard. The boundaries do not depend on the photos or selected lens, so adding new lenses never reclassifies existing photos. Only nonempty bands appear. Each row and the selected photo heading show the actual interval; individual photo details retain their original focal length.

| Band / URL identifier               | Actual focal length interval (mm) |
| ----------------------------------- | --------------------------------- |
| Ultra-wide / `ultra-wide`           | 0 < focal < 18                    |
| Around 20 / `20`                    | 18 ≤ focal < 22                   |
| Around 24 / `24`                    | 22 ≤ focal < 26                   |
| Around 28 / `28`                    | 26 ≤ focal < 31.5                 |
| Around 35 / `35`                    | 31.5 ≤ focal < 42.5               |
| Around 50 / `50`                    | 42.5 ≤ focal < 67.5               |
| Around 85 / `85`                    | 67.5 ≤ focal < 95                 |
| Around 105 / `105`                  | 95 ≤ focal < 120                  |
| Around 135 / `135`                  | 120 ≤ focal < 167.5               |
| Around 200 / `200`                  | 167.5 ≤ focal < 250               |
| Around 300 / `300`                  | 250 ≤ focal < 350                 |
| Around 400 / `400`                  | 350 ≤ focal < 500                 |
| Around 600 / `600`                  | 500 ≤ focal < 700                 |
| Super-telephoto / `super-telephoto` | focal ≥ 700                       |

Every valid focal length belongs to exactly one band. At each boundary the longer band owns the exact boundary value. For example, 55mm belongs to the 50mm band, while 67.5mm belongs to the 85mm band. The end bands cover future lenses beyond the representative prime lengths.

The lens selector defaults to all photos and does not inherit the gallery's tag, camera, rating or date filters. Its options count all photos with that lens, including photos missing focal length. The `lens` query parameter is the same trimmed make/model label used by the gallery's existing lens filter. The `focal` parameter identifies a band using the stable identifiers above, or `unknown` for excluded photos. For example, `focal=105` selects the complete 95–<120mm interval. The initial selection is the most frequent band (the shorter band wins a tie) and is recorded in the URL. Changing lens selects that lens's most frequent valid band.

Selecting a row displays its photos using the existing masonry grid. The shared photo viewer navigates only the current group at `/focal-lengths/photos/:photoId`; closing returns to the statistics page with its lens/focal selection intact. Refresh and browser navigation restore the selection. Gallery filter query parameters are preserved for the return link but do not affect these statistics. Unknown photo IDs and photos outside the selected group are not replaced with a different photo.

The page reads the existing manifest and thumbnail/preview assets. It requires neither a new storage layout nor a manifest rebuild when focal metadata already exists. Existing private-gallery access protection also covers these routes.

Run the statistical regression tests with `pnpm --filter @afilmory/web test:focal-lengths`. They cover decimal parsing, actual versus equivalent focal length, invalid metadata, denominator handling, lens filtering, empty scopes, all 13 interval boundaries, future long lenses and stable grouping across collection changes. A 129-photo regression fixture reproduces the observed gallery's 43 exact focal lengths: the seven populated bands contain 1, 9, 6, 8, 34, 24 and 47 photos. Browser verification uses synthetic photos; distribution accuracy for the deployed gallery depends on the metadata retained in its manifest.

Initial implementation validation on 2026-10-15: eight statistical tests and 33 existing viewer tests passed, as did web TypeScript checking and Vite-to-Next production builds. Edge checks with eight synthetic photos covered lens counts and percentages, fractional focal length in photo details, missing data, scoped navigation, direct-photo refresh and Escape, browser back/forward, preserving gallery filter parameters, command-palette access, invalid-link recovery, and desktop/320px/390px layouts. Unauthenticated HTTP requests to both new route forms redirected to gallery unlock. These checks do not measure real R2 latency or physical-device touch behavior.

Fixed-band revision validation on 2026-10-15: all 24 statistical tests passed, along with changed-file ESLint, web TypeScript checking, Vite and Next.js production builds. Edge checks reproduced the seven populated bands using synthetic photos with the observed 129-photo focal counts, verified that the 55mm prime selects the 50mm band with 11 photos at 100%, and exercised scoped photo opening, arrow navigation and Escape. Desktop and 320px layouts retained readable intervals without horizontal overflow. Additional fixtures exercised 135/200/300/400/600mm and 1600mm lenses, missing focal metadata, the exclusive valid-photo denominator, URL restoration on refresh, and browser back navigation. Screenshots use synthetic images rather than published photographs.
