#!/bin/bash
set -e # Exit on error (if cmd fails)

handle_error() {
  local line="$1"
  local cmd="$2"
  echo "" >&2
  echo "Build failed at line $line: $cmd" >&2
  if [ -t 0 ]; then
    read -r -p "Press Enter to exit..."
  fi
  exit 1
}
trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

# Make sure Clang is installed
# if command -v clang &> /dev/null; then
#   echo "Clang is installed."
# else
#   echo "Installing Clang..."
#   apt-get install -y clang
# fi

# Make sure Cargo is installed and needed as a dependency to create the WASM lib
if command -v cargo &> /dev/null; then
  echo "Cargo is installed."
else 
  echo "Installing Cargo..."

  # Download & run rustup installer
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --default-toolchain none -y

  # Source the Cargo env
  source "$HOME/.cargo/env"

  # Install nightly toolchain
  rustup toolchain install nightly
  rustup component add rust-src --toolchain nightly

  echo "Cargo installed successfully."
fi

# Make sure wasm-pack is installed
cargo install wasm-pack

export RUSTUP_TOOLCHAIN="nightly"
wasm-pack build --release xelis-playground --target web --out-dir ../public --no-typescript --no-package -- -Z build-std=std,panic_abort