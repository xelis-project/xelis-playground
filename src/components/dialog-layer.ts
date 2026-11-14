import { UIContainers } from './panel-controller';

/** Shared focus, dismissal, and viewport behavior for every workspace dialog. */
export class DialogLayer {
    private readonly layer = document.getElementById('dialog-layer')!;
    private readonly opened = new Map<HTMLElement, HTMLElement | null>();
    private active?: HTMLElement;

    constructor() {
        new MutationObserver(() => this.sync()).observe(this.layer, { subtree: true, attributes: true, attributeFilter: ['class'] });
        this.layer.addEventListener('click', event => {
            const target = event.target as HTMLElement;
            const dismiss = target.closest<HTMLElement>('[data-dismiss]');
            if (dismiss) this.close(document.getElementById(dismiss.dataset.dismiss!)!);
            else if (target.matches('.modal-backdrop, .panel_backdrop')) this.close(target.parentElement!);
        });
        document.addEventListener('keydown', event => {
            if (!this.active) return;
            if (event.key === 'Escape') { event.preventDefault(); this.close(this.active); }
            if (event.key !== 'Tab') return;
            const controls = Array.from(this.active.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
                .filter(element => element.getClientRects().length && !element.closest('.hide, .hidden'));
            const first = controls[0];
            const last = controls.at(-1);
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === this.active.querySelector('.panel_body, .modal-frame') || !this.active.contains(document.activeElement))) {
                event.preventDefault(); last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        });
        this.sync();
    }

    private sync() {
        const visible = Array.from(this.layer.children).filter((element): element is HTMLElement => {
            if (!(element instanceof HTMLElement) || element.matches('.hide, .hidden')) return false;
            return element.matches('.modal') || !!element.querySelector(':scope > .panel_body:not(.hide)');
        });
        for (const [dialog, opener] of this.opened) {
            if (!visible.includes(dialog)) {
                this.opened.delete(dialog);
                if (visible.length === 0) {
                    document.getElementById('app')!.removeAttribute('inert');
                    opener?.focus();
                }
            }
        }
        for (const dialog of visible) {
            if (!this.opened.has(dialog)) {
                this.opened.set(dialog, document.activeElement as HTMLElement);
                const body = dialog.querySelector<HTMLElement>('.panel_body, .modal-frame')!;
                body.setAttribute('role', 'dialog');
                body.setAttribute('aria-modal', 'true');
                body.setAttribute('aria-label', body.querySelector('.panel-title, .modal-title, h5')?.textContent?.trim() || 'Workspace dialog');
                body.tabIndex = -1;
                body.focus();
            }
        }
        this.active = [...this.opened.keys()].at(-1);
        if (this.active) document.getElementById('app')!.setAttribute('inert', '');
    }

    private close(dialog: HTMLElement) {
        const closeButtons: Record<string, string> = {
            editor_project_container: 'btn_close_project_panel',
            storage_preset_container: 'btn_close_storage_editor',
            parameter_builder_container: 'btn_close_arg_editor',
        };
        const closeId = closeButtons[dialog.id];
        if (closeId) { document.getElementById(closeId)?.click(); return; }
        if (dialog.classList.contains('modal')) dialog.classList.add('hidden');
        else UIContainers.dismiss(dialog.id);
    }
}
