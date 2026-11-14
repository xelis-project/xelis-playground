#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# wasm-pack selects a wasm-bindgen CLI matching Cargo.lock.
for tool in cargo rustup wasm-pack; do
  command -v "$tool" >/dev/null || { echo "Missing $tool. See README.md for setup." >&2; exit 1; }
done
export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-nightly}"
wasm-pack build --release xelis-playground --target web --out-dir ../public --no-package -- \
  --locked -Z build-std=std,panic_abort
