#!/usr/bin/env bash
#
# Build a Chrome Web Store zip containing only the files the extension needs.
# The zip is written next to the project folder and named with the manifest version.
# This script and all dev files (git, docs, signing key) are excluded by design,
# because only the paths listed in INCLUDE are packaged.

set -euo pipefail

# Move to the project root (the directory this script lives in).
cd "$(dirname "$0")"

# Files/folders to include in the zip. Everything else is left out.
INCLUDE=(manifest.json src icons _locales)

# Read the version from manifest.json (no external tools required).
VERSION=$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

# Output path: next to the project folder.
OUTPUT="../meter-for-youtube-v${VERSION}.zip"

# Remove any previous build with the same name.
rm -f "$OUTPUT"

# Create the zip, excluding macOS metadata files.
zip -r "$OUTPUT" "${INCLUDE[@]}" -x '*.DS_Store' >/dev/null

echo "Created $(cd "$(dirname "$OUTPUT")" && pwd)/$(basename "$OUTPUT")"
echo
unzip -l "$OUTPUT"
