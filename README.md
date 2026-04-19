# XELIS Playground

Try the Silex programming language for the XELIS Smart Contract Platform.

Fully client-side, no server-side code execution.

## Requirements

Cargo is required to build the WebAssembly module. You can install it from [rustup](https://rustup.rs/).

NPM (Node Package Manager) is required to install the necessary JavaScript dependencies. You can install it from [Node.js](https://nodejs.org/).

A WebAssembly-compatible browser is required to run the playground.

Most modern browsers support WebAssembly, but it's recommended to use the latest version of Chrome, Firefox, or Edge for the best experience.

The framework Vite is used for the development server and build process. You can install it globally using npm:

```bash
npm install -g vite
```

## Build

Simply use the script `build_wasm.sh` to build the WebAssembly module. This script will compile the Rust code into a `.wasm` file that can be used in the playground.

```bash
./build_wasm.sh
```

## Run

To run the playground, use the following command to start the development server:

```bash
npm run dev
```

## Deploy

In case you would like to deploy this playground, you can build the production version using using Vite:

```bash
npm run build
```

A `dist` folder will be created with the production-ready files.
It must be served using a static file server to work properly, as it relies on the WebAssembly module being loaded correctly.