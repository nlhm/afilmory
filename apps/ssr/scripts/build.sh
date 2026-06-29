#!/bin/bash
set -e
cd ../web
AFILMORY_EMBED_MANIFEST=false pnpm build

rm -rf ../ssr/public
cp -r dist ../ssr/public
cd ../ssr

node scripts/embed-manifest.mjs
node scripts/prepare-web-shell.mjs
rm ./public/index.html
pnpm build:next
