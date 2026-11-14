export type Deposit = { hash: string; amount: string; depositType: 'public' };

export function renderDeposits(container: HTMLElement, deposits: Deposit[], onRemove: (index: number) => void) {
    container.replaceChildren();
    if (!deposits.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No deposits yet. Add an asset to fund this simulated execution.';
        container.append(empty);
        return;
    }
    deposits.forEach((deposit, index) => {
        const row = document.createElement('div');
        row.className = 'deposit-row';
        for (const [key, title, placeholder] of [
            ['hash', 'Asset hash', '64 hexadecimal characters'],
            ['amount', 'Amount', 'Atomic units'],
        ] as const) {
            const label = document.createElement('label');
            label.textContent = title;
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = placeholder;
            input.value = deposit[key];
            input.spellcheck = false;
            if (key === 'amount') input.inputMode = 'numeric';
            input.addEventListener('input', () => { deposit[key] = input.value; });
            label.append(input);
            row.append(label);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'deposit-remove opt-btn';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove deposit ${index + 1}`);
        remove.addEventListener('click', () => onRemove(index));
        row.append(remove);
        container.append(row);
    });
}
