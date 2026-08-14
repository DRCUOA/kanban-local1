#!/usr/bin/env bash
# Regenerates every raster icon in client/public from the SVG sources in
# this directory. Requires rsvg-convert (brew install librsvg).
set -euo pipefail

cd "$(dirname "$0")"
OUT=../../client/public

rsvg-convert -w 32 -h 32 mark-32.svg -o "$OUT/favicon.png"
rsvg-convert -w 16 -h 16 mark-16.svg -o "$OUT/favicon-16.png"
rsvg-convert -w 180 -h 180 mark-app-icon.svg -o "$OUT/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 mark-app-icon.svg -o "$OUT/icon-192.png"
rsvg-convert -w 512 -h 512 mark-app-icon.svg -o "$OUT/icon-512.png"

echo "Icons written to client/public/"
