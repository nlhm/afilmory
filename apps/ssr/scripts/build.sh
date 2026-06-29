#!/bin/bash
set -e
cd ../web
AFILMORY_EMBED_MANIFEST=false pnpm build

rm -rf ../ssr/public
cp -r dist ../ssr/public
cd ../ssr
# Convert HTML to JS format with exported string
node scripts/prepare-web-shell.mjs
rm ./public/index.html
# pnpm build:jpg
pnpm build:next
