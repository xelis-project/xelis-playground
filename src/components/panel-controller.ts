const Noop = () => {};

export type PanelOptions = {
    initiator: HTMLElement | null;
    data_panel_id: string | null;
    before_open: () => void;
    after_open: () => void;
    before_close: () => void;
    after_close: () => void;
};

type UIInput = { container: HTMLElement; label: HTMLLabelElement; input: HTMLInputElement };

/** Feature controllers retain their callbacks; the dialog layer owns presentation. */
export class UIContainers {
    private static openPanels = new Map<string, PanelOptions>();
    private static inputSequence = 0;

    static get_panel_selection_container(selector: string) {
        return document.querySelector(`${selector} > .panel_body .po-selection`);
    }

    static panel_options(options: Partial<PanelOptions> = {}): PanelOptions {
        return {
            initiator: null, data_panel_id: null,
            before_open: Noop, after_open: Noop, before_close: Noop, after_close: Noop,
            ...options,
        };
    }

    static get_container_id(options: PanelOptions): string {
        if (options.initiator && options.data_panel_id) return '';
        return options.initiator?.dataset.panelId ?? options.data_panel_id ?? '';
    }

    static panel_open(options: PanelOptions) {
        const id = this.get_container_id(options);
        const container = document.getElementById(id);
        if (!container) return null;
        this.openPanels.set(id, options);
        options.before_open();
        container.querySelector('.panel_backdrop')?.classList.remove('hide');
        container.querySelector('.panel_body')?.classList.remove('hide');
        options.after_open();
        return container;
    }

    static panel_close(options: PanelOptions) {
        const id = this.get_container_id(options);
        const container = document.getElementById(id);
        const body = container?.querySelector('.panel_body');
        if (!body || body.classList.contains('hide')) return;
        const opened = this.openPanels.get(id);
        const before = options.before_close !== Noop ? options.before_close : opened?.before_close ?? Noop;
        const after = options.after_close !== Noop ? options.after_close : opened?.after_close ?? Noop;
        before();
        container?.querySelector('.panel_backdrop')?.classList.add('hide');
        body.classList.add('hide');
        this.openPanels.delete(id);
        after();
    }

    static dismiss(id: string) {
        const options = this.openPanels.get(id);
        if (options) this.panel_close(options);
    }

    static panel_toggle(options: PanelOptions) {
        const container = document.getElementById(this.get_container_id(options));
        if (container?.querySelector('.panel_body')?.classList.contains('hide')) this.panel_open(options);
        else this.panel_close(options);
    }

    static make_input_component(labelText: string, type: string): UIInput {
        const container = document.createElement('div');
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.id = `workspace-input-${++this.inputSequence}`;
        input.type = type;
        input.placeholder = labelText;
        input.classList.add('large-input');
        label.textContent = labelText;
        label.htmlFor = input.id;
        container.append(label, input);
        return { container, label, input };
    }
}
