#!/usr/bin/env bash
set -euo pipefail

deploy_root=/srv/ecommerce
runtime_bin="$deploy_root/runtime/current/bin"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /srv/ecommerce/releases/<release-id>" >&2
  exit 64
fi

release_dir="$(realpath -e -- "$1")"
case "$release_dir" in
  "$deploy_root"/releases/*) ;;
  *)
    echo "Release must be inside $deploy_root/releases" >&2
    exit 65
    ;;
esac

if [[ ! -f "$release_dir/backend/package-lock.json" || ! -f "$release_dir/backend/src/server.js" ]]; then
  echo "Release is missing backend files" >&2
  exit 66
fi

if [[ ! -x "$runtime_bin/node" || ! -x "$runtime_bin/npm" ]]; then
  echo "Node runtime is not installed at $runtime_bin" >&2
  exit 67
fi

export PATH="$runtime_bin:$PATH"
npm --prefix "$release_dir/backend" ci --omit=dev

while IFS= read -r -d '' source_file; do
  node --check "$source_file"
done < <(find "$release_dir/backend/src" -type f -name '*.js' -print0)

npm --prefix "$release_dir/backend" test

temporary_link="$deploy_root/.current-$(basename "$release_dir")-$$"
trap 'rm -f -- "$temporary_link"' EXIT
ln -s -- "$release_dir" "$temporary_link"
mv -Tf -- "$temporary_link" "$deploy_root/current"
trap - EXIT

echo "Activated backend release: $(basename "$release_dir")"
