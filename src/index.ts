import { App } from "./app";
import { Silex } from "./silex";
import './styles';

async function main() {
    const silex = new Silex();
    await silex.init();

    new App(silex);
}

main();
