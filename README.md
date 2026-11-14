# XELIS Playground

A browser workspace for writing, compiling, and testing Silex contracts. Compilation
and simulated execution run locally through WebAssembly. RPC and wallet tools connect
to external services only when requested.

## Development

Requirements: Node.js with npm, Rust nightly with `rust-src`, and `wasm-pack`.

```sh
rustup toolchain install nightly --component rust-src
cargo install wasm-pack --locked
npm ci
npm run build:wasm
npm run dev
```

The WASM build uses `Cargo.lock` and generates both browser bindings and TypeScript
declarations in `public/`. Rebuild it whenever Rust code or dependencies change.
`wasm-pack` selects the matching `wasm-bindgen` CLI; a separately installed older CLI
cannot process a newer WASM schema.

## Checks

```sh
npm run check       # TypeScript
npm test            # Rust compilation and execution regression tests
npm run build       # Production frontend, after building WASM
npm run preview
npm run test:ui     # Browser layout and compile/run regression checks
```

The browser checks cover 320–1440px widths, short landscape screens, all tool panels,
dialogs, exports, and compilation/execution. They use local Chrome when available;
otherwise run `npx playwright-core install chromium`, or set `BROWSER_EXECUTABLE`.
For isolated containers that require it, set `BROWSER_NO_SANDBOX=1`.

## Hosting

Serve `dist/` over HTTPS (or localhost). WebAssembly worker execution requires these
headers on the page and resources:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite development and preview servers set these headers. `public/_headers` supplies
the equivalent rules for hosts supporting that format. Other static hosts must
configure them explicitly. Keep the generated JavaScript, WASM, and any worker
assets together; the production build fingerprints the runtime for cache invalidation.
