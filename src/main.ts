import xelis_init, { Silex } from '../public/xelis_playground';
import { renderWorkspace, WorkspaceController } from './components/workspace';
import { Dropdowns } from './components/dropdowns';
import { DialogLayer } from './components/dialog-layer';
import './styles/index';

renderWorkspace();
new WorkspaceController();
new DialogLayer();
new Dropdowns();

async function main() {
    const workspace = document.getElementById('app')!;
    const status = document.getElementById('runtime-status')!;
    const message = document.getElementById('runtime-status-text')!;
    try {
        if (!window.crossOriginIsolated) {
            throw new Error('This page needs cross-origin isolation. Serve it with the COOP and COEP headers described in the README.');
        }
        await xelis_init();
        const { App } = await import('./app');
        new App(new Silex());
        workspace.removeAttribute('inert');
        status.dataset.state = 'ready';
        message.textContent = 'Runtime ready';
    } catch (error) {
        console.error('Unable to initialize the playground', error);
        status.dataset.state = 'error';
        message.textContent = 'Runtime unavailable';
        const output = document.getElementById('output')!;
        output.textContent = `${error instanceof Error ? error.message : String(error)}\nReload the page after resolving the issue.`;
        output.setAttribute('role', 'alert');
        workspace.removeAttribute('inert');
        workspace.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = true);
        // Keep failed controls inert while leaving the error readable.
    }
}

void main();
