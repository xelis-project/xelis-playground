const Noop = ()=> {}

export type PanelOptions = {
    initiator: HTMLElement | null,
    data_panel_id: string | null
    before_open: (() => void),
    after_open: (() => void),
    before_close: (() => void),
    after_close: (() => void),
}

type UIInput = {
    container: HTMLElement;
    label: HTMLElement;
    input: HTMLInputElement;
};

export class UIContainers {
    static get_panel_selection_container(selector: String) {
        return document.querySelector(`${selector} > div.panel_body > div > div.po-selection`);
    }

    static panel_options({initiator = null,
                                    data_panel_id = null,
                                     before_open = Noop,
                                     after_open = Noop,
                                     before_close = Noop,
                                     after_close = Noop}: PanelOptions) {
        return {initiator: initiator,
            data_panel_id: data_panel_id,
            before_open: before_open,
            after_open: after_open,
            before_close: before_close,
            after_close: after_close} as PanelOptions;
    }

    // Initiator supplies the id of the panel to open so that we can change
    // the id for styling purposes in the html without having to modify
    // code as well.

    static get_container_id(p_opts: PanelOptions) {
        let panel_container_id: string = "";

        if(p_opts.initiator === null && p_opts.data_panel_id === null) {
            console.log(`ERROR: No panel to open. There is no initiator (eg. button with a data-panel-id attribute) and the "data_panel_id" is unset.`);
            return panel_container_id;
        }

        if(p_opts.initiator !== null && p_opts.data_panel_id !== null) {
            console.log(`ERROR: Both initiator and data_panel_id are set. Only one should be set.`);
            return panel_container_id;
        }

        if(p_opts.initiator?.getAttribute("data-panel-id") !== null && p_opts.initiator?.getAttribute("data-panel-id") !== undefined) {
            panel_container_id = p_opts.initiator?.getAttribute("data-panel-id") as string;
        } else {
            panel_container_id = p_opts.data_panel_id as string;
        }

        return panel_container_id;
    }

    static panel_open(p_opts: PanelOptions) {
        const panel_container_id =  UIContainers.get_container_id(p_opts);
        if(panel_container_id === "") {
            return null;
        }
        const panel_container = document.querySelector(`#${panel_container_id}`) as HTMLElement;
        const panel_backdrop = panel_container.querySelector(`.panel_backdrop`) as HTMLElement;
        const panel_body = panel_container.querySelector(`.panel_body`) as HTMLElement;

        p_opts.before_open();
        panel_backdrop.classList.remove('hide');
        panel_body.classList.remove('hide');
        p_opts.after_open();

        return panel_container;
    }

    static panel_close(p_opts: PanelOptions) {
        const panel_container_id =  UIContainers.get_container_id(p_opts);
        if(panel_container_id === "") {
            return;
        }

        const panel_container = document.querySelector(`#${panel_container_id}`) as HTMLElement;
        const panel_backdrop = panel_container.querySelector(`.panel_backdrop`) as HTMLElement;
        const panel_body = panel_container.querySelector(`.panel_body`) as HTMLElement;

        p_opts.before_close();
        panel_backdrop.classList.add('hide');
        panel_body.classList.add('hide');
        p_opts.after_close();
    }

    static panel_toggle(p_opts: PanelOptions) {
        const panel_container_id =  UIContainers.get_container_id(p_opts);
        if(panel_container_id === "") {
            return;
        }

        const panel_body = document.querySelector(`#${panel_container_id} .panel_body`) as HTMLElement;

        if (panel_body.classList.contains('hide')) {
            UIContainers.panel_open(p_opts);
        } else {
            UIContainers.panel_close(p_opts);
        }
    }

    static make_input_component(label_name: string, type: string): UIInput {
        const input_container = document.createElement('div');

        const label = document.createElement('label');
        label.textContent = `${label_name}`;

        const input = document.createElement('input');
        input.setAttribute("type", type);
        input.setAttribute("placeholder", `${label_name}`);
        input.classList.add("large-input");

        input_container.appendChild(label);
        input_container.appendChild(input);

        return {container: input_container, label: label, input: input};
    }

    static click_event_cleanup(elems: HTMLElement[]) {
        elems.forEach(e => {
            e.removeEventListener("click", _ => {
                console.log("click event cleanup");
            });
        });
    }


}