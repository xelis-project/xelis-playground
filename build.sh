export RUSTUP_TOOLCHAIN="nightly"
export RUSTFLAGS="-C target-feature=+atomics,+bulk-memory,+mutable-globals"
wasm-pack build xelis-playground --target web --out-dir ../public --no-typescript --no-package -- -Z build-std=std,panic_abort