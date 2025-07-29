import xelis_init, { Silex } from '../public/xelis_playground';
import { App } from "./app";
import './styles';

async function main() {
    console.log("Loading Silex WASM module...");
    await xelis_init();
    console.log("Silex WASM module loaded!");
    const silex = new Silex();
    new App(silex);
}

main();
