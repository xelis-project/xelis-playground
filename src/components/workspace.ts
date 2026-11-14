import logo from './templates/logo.html?raw';
import editor from './templates/editor.html?raw';
import consolePanel from './templates/console.html?raw';
import execution from './templates/execution.html?raw';
import tools from './templates/tools.html?raw';
import dialogs from './templates/dialogs.html?raw';

const icon = (paths: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
    run: icon('<path d="m9 5 11 7-11 7z"/>'),
    library: icon('<path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15"/>'),
    rpc: icon('<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 7h6M11 18h6"/>'),
    wallet: icon('<path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7M21 12h-5v5h5"/>'),
    projects: icon('<path d="M3 7V5h6l2 2h10v13H3z"/>'),
    settings: icon('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>'),
};

export function renderWorkspace() {
    document.getElementById('workspace-root')!.innerHTML = `
      <a class="skip-link" href="#input_editor">Skip to source editor</a>
      <header class="site-header">
        <div class="brand-group">${logo}<span class="brand-divider"></span><span class="product-name">Playground <small>Silex workspace</small></span></div>
        <nav aria-label="Resources"><a href="https://docs.xelis.io" target="_blank" rel="noopener noreferrer">Docs ↗</a><a href="https://github.com/xelis-project/xelis-playground" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav>
        <div class="runtime-badge" role="status" id="runtime-status"><span class="status-dot"></span><span id="runtime-status-text">Loading runtime…</span></div>
      </header>
      <main id="app" data-mobile-view="code" aria-label="Contract workspace" inert>
        <aside class="tool-rail" aria-label="Workspace navigation">
          <div class="mode-panel-controls" role="tablist" aria-label="Workspace tools" aria-orientation="vertical">
            <button id="btn_mode_contract" class="rail-button" title="Run contract">${icons.run}<span>Run</span></button>
            <button id="btn_mode_documentation" class="rail-button" title="Standard library">${icons.library}<span>Library</span></button>
            <button id="btn_mode_rpcinspector" class="rail-button" title="RPC inspector">${icons.rpc}<span>RPC</span></button>
            <button id="btn_mode_account" class="rail-button" title="Wallet account">${icons.wallet}<span>Wallet</span></button>
          </div>
          <div class="rail-utilities">
            <button id="btn_editor_project" class="rail-button" data-panel-id="editor_project_container" title="Projects and examples">${icons.projects}<span>Projects</span></button>
            <button id="btn_editor_options" class="rail-button" data-panel-id="editor_options_container" title="Workspace settings">${icons.settings}<span>Settings</span></button>
          </div>
        </aside>
        <div class="workspace-main">
          <header class="workspace-toolbar"><div><h1>Build. Run. Explore.</h1><p>Your contracts, in your browser.</p></div><button id="btn_editor_compile" class="primary-button" title="Compile (Ctrl / ⌘ + Enter)">Compile <kbd>⌘ / Ctrl ↵</kbd></button></header>
          <div class="mobile-views" role="tablist" aria-label="Workspace view">
            <button role="tab" id="view-code" data-view="code" aria-controls="editor_container" aria-selected="true">Code</button>
            <button role="tab" id="view-tools" data-view="tools" aria-controls="screen_right" aria-selected="false" tabindex="-1">Tools</button>
            <button role="tab" id="view-console" data-view="console" aria-controls="console_panel" aria-selected="false" tabindex="-1">Console</button>
          </div>
          <div class="workspace-body">
            <div id="screen_left">${editor}${consolePanel}</div>
            <aside id="screen_right" aria-label="Inspector"><div id="screen_right_content"><header class="inspector-header"><div><p class="eyebrow">WORKSPACE TOOLS</p><h2 id="r_mode_title">Run contract</h2></div><span class="inspector-mark" aria-hidden="true">/</span></header>${execution}${tools}</div></aside>
          </div>
          <footer class="workspace-footer"><span><span class="status-dot"></span> Local execution</span><span>SILEX / XVM</span></footer>
        </div>
      </main>
      <div id="dialog-layer">${dialogs}</div>`;
}

export class WorkspaceController {
    private readonly app = document.getElementById('app')!;
    private readonly mobile = window.matchMedia('(max-width: 959px)');
    private readonly tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-view]'));

    constructor() {
        this.tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => this.show(tab.dataset.view!));
            tab.addEventListener('keydown', event => {
                let next = index;
                if (event.key === 'ArrowRight') next = (index + 1) % this.tabs.length;
                else if (event.key === 'ArrowLeft') next = (index + this.tabs.length - 1) % this.tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = this.tabs.length - 1;
                else return;
                event.preventDefault();
                this.tabs[next].click();
                this.tabs[next].focus();
            });
        });
        document.addEventListener('workspace:show-tools', () => this.show('tools'));
        document.addEventListener('workspace:show-console', () => this.show('console'));
        document.addEventListener('workspace:show-code', () => this.show('code'));
        this.mobile.addEventListener('change', () => this.updateOrientation());
        this.updateOrientation();
    }

    private show(view: string) {
        this.app.dataset.mobileView = view;
        this.tabs.forEach(tab => {
            const selected = tab.dataset.view === view;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        window.dispatchEvent(new Event('resize'));
    }

    private updateOrientation() {
        document.querySelector('.mode-panel-controls')!.setAttribute('aria-orientation', this.mobile.matches ? 'horizontal' : 'vertical');
        window.dispatchEvent(new Event('resize'));
    }
}
