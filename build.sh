#!/bin/bash

# Make sure Cargo is installed and needed as a dependency to create the WASM lib
if command -v cargo &> /dev/null; then
  echo "Cargo is installed."
else 
  echo "Installing Cargo..."

  # Download & run rustup installer
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

  # Install nightly channel and components
  rustup install nightly

  # Set nightly as default
  rustup default nightly

  # Source the Cargo env
  source "$HOME/.cargo/env"

  echo "Cargo installed successfully."
fi

# Make sure wasm-pack is installed
cargo install wasm-pack

# Create WASM lib for javascript browser
export RUSTUP_TOOLCHAIN="nightly"
export RUSTFLAGS="-C target-feature=+atomics,+bulk-memory,+mutable-globals"
wasm-pack build xelis-playground --target web --out-dir ../public --no-typescript --no-package -- -Z build-std=std,panic_abort