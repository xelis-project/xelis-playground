/** Delegated dropdown behavior also covers dynamically generated project/storage menus. */
export class Dropdowns {
    constructor() {
        const prepare = () => {
          document.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(control => {
            const label = control.dataset.tooltip ?? '';
            control.title = label;
            control.setAttribute('aria-label', label);
          });
          document.querySelectorAll<HTMLElement>('.menu-stat-ro').forEach(trigger => {
            trigger.tabIndex = 0;
            trigger.setAttribute('role', 'button');
            trigger.setAttribute('aria-haspopup', 'true');
            trigger.setAttribute('aria-expanded', String(trigger.closest('.dropdown')?.classList.contains('is-open')));
          });
        };
        prepare();
        new MutationObserver(prepare).observe(document.getElementById('workspace-root')!, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tooltip'] });
        document.addEventListener('click', event => {
            const target = event.target as HTMLElement;
            if (target.closest('.dropdown-content a')) { this.closeAll(); return; }
            const trigger = target.closest<HTMLElement>('.menu-stat-ro');
            if (!trigger) { this.closeAll(); return; }
            const dropdown = trigger.closest<HTMLElement>('.dropdown')!;
            const open = !dropdown.classList.contains('is-open');
            this.closeAll();
            dropdown.classList.toggle('is-open', open);
            trigger.setAttribute('aria-expanded', String(open));
            dropdown.querySelectorAll<HTMLElement>('.dropdown-content a').forEach(option => option.tabIndex = open ? 0 : -1);
        });
        document.addEventListener('keydown', event => {
            const target = event.target as HTMLElement;
            const dropdown = target.closest<HTMLElement>('.dropdown');
            if (!dropdown) return;
            if (event.key === 'Escape' && dropdown.classList.contains('is-open')) { event.stopImmediatePropagation(); this.closeAll(); dropdown.querySelector<HTMLElement>('.menu-stat-ro')?.focus(); return; }
            if (target.matches('.menu-stat-ro') && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
                event.preventDefault(); this.closeAll(); dropdown.classList.add('is-open'); target.setAttribute('aria-expanded', 'true');
                const options = dropdown.querySelectorAll<HTMLElement>('.dropdown-content a');
                options.forEach(option => option.tabIndex = 0);
                options[0]?.focus();
            } else if (target.matches('.dropdown-content a') && ['Enter', ' '].includes(event.key)) {
                event.preventDefault(); target.click(); dropdown.querySelector<HTMLElement>('.menu-stat-ro')?.focus();
            }
        }, true);
    }

    private closeAll() {
        document.querySelectorAll('.dropdown.is-open').forEach(dropdown => {
            dropdown.classList.remove('is-open');
            dropdown.querySelector('.menu-stat-ro')?.setAttribute('aria-expanded', 'false');
            dropdown.querySelectorAll<HTMLElement>('.dropdown-content a').forEach(option => option.tabIndex = -1);
        });
    }
}
