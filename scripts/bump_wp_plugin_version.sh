#!/usr/bin/env bash
set -euo pipefail

PLUGIN_FILE="wp_sources_php/wp_plugin/wp-car-auction-plugin-lite/wp-car-auction-plugin-lite.php"
BUMP_TYPE="${1:-patch}"

if [[ ! -f "$PLUGIN_FILE" ]]; then
  echo "Plugin file not found: $PLUGIN_FILE" >&2
  exit 1
fi

current_version="$(grep -E '^\* Version:' "$PLUGIN_FILE" | sed -E 's/^\* Version:[[:space:]]*//')"
if [[ -z "$current_version" ]]; then
  echo "Failed to read current version from plugin header" >&2
  exit 1
fi

IFS='.' read -r major minor patch <<< "$current_version"
major="${major:-0}"
minor="${minor:-0}"
patch="${patch:-0}"

case "$BUMP_TYPE" in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch)
    patch=$((patch + 1))
    ;;
  *)
    echo "Unknown bump type: $BUMP_TYPE (allowed: major|minor|patch)" >&2
    exit 1
    ;;
esac

new_version="${major}.${minor}.${patch}"

sed -i -E "s/^(\* Version: )[0-9]+\.[0-9]+\.[0-9]+$/\1${new_version}/" "$PLUGIN_FILE"
sed -i -E "s/^(const CAR_AUCTION_VERSION = ')[0-9]+\.[0-9]+\.[0-9]+(';)/\1${new_version}\2/" "$PLUGIN_FILE"

echo "$new_version"
