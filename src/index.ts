import { Silex } from '../public/xelis_playground';
import { App } from "./app";
import './styles';

async function main() {
    const silex = new Silex();
    new App(silex);
}

main();
