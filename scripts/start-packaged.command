#!/bin/bash
set -eu
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
app_executable="$repo_dir/release/Orbit Nest-darwin-arm64/Orbit Nest.app/Contents/MacOS/Orbit Nest"
if [ ! -x "$app_executable" ]; then
  echo "Build the desktop package with npm run package before launching." >&2
  exit 1
fi
cd "$repo_dir"
exec "$app_executable"
