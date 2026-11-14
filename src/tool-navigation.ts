type WorkspaceMode = { button: HTMLButtonElement; panel: HTMLElement; label: string };

/** One source of truth for selected panels, focus, and tab accessibility. */
export class RightPanelModes {
    readonly btn_mode_contract = document.getElementById('btn_mode_contract') as HTMLButtonElement;
    readonly btn_mode_documentation = document.getElementById('btn_mode_documentation') as HTMLButtonElement;
    readonly btn_mode_rpcinspector = document.getElementById('btn_mode_rpcinspector') as HTMLButtonElement;
    readonly btn_mode_account = document.getElementById('btn_mode_account') as HTMLButtonElement;
    private readonly modes: WorkspaceMode[];

    constructor() {
        this.modes = [
            { button: this.btn_mode_contract, panel: document.getElementById('contract_container')!, label: 'Run contract' },
            { button: this.btn_mode_documentation, panel: document.getElementById('documentation_container')!, label: 'Standard library' },
            { button: this.btn_mode_rpcinspector, panel: document.getElementById('rpcinspector_container')!, label: 'RPC Inspector' },
            { button: this.btn_mode_account, panel: document.getElementById('account_container') ?? document.getElementById('account-panel-container')!, label: 'Wallet' },
        ];
        this.modes.forEach((mode, index) => {
            mode.button.removeAttribute('disabled');
            mode.button.setAttribute('role', 'tab');
            mode.button.setAttribute('aria-controls', mode.panel.id);
            mode.panel.setAttribute('role', 'tabpanel');
            mode.panel.setAttribute('aria-labelledby', mode.button.id);
            mode.button.addEventListener('click', () => {
                this.select(index);
                document.dispatchEvent(new Event('workspace:show-tools'));
            });
            mode.button.addEventListener('keydown', event => {
                let next = index;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % this.modes.length;
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + this.modes.length - 1) % this.modes.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = this.modes.length - 1;
                else return;
                event.preventDefault();
                this.select(next);
                this.modes[next].button.focus();
            });
        });
        this.select(0);
    }

    private select(index: number) {
        this.modes.forEach((mode, current) => {
            const selected = current === index;
            mode.button.setAttribute('aria-selected', String(selected));
            mode.button.tabIndex = selected ? 0 : -1;
            mode.panel.classList.toggle('rpm-show', selected);
            mode.panel.classList.toggle('rpm-hide', !selected);
            if (selected) mode.panel.scrollTop = 0;
        });
        document.getElementById('r_mode_title')!.textContent = this.modes[index].label;
    }
}
