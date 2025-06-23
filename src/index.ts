import xelis_init from '../public/xelis_playground';
import { App } from "./app";

async function main() {
    console.log("Loading Silex WASM module...");
    await xelis_init();
    console.log("Silex WASM module loaded!");
    new App();
}

main();
