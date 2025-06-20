export class CustomSelect {
    constructor() {
        // Add event listener to close all select boxes when clicking outside
        document.addEventListener("click", (e) => {
            this.close_all_select(e.target as HTMLElement);
        });

        this.build_selects();
    }

    clear_selects() {
        const elements = document.querySelectorAll(`.select-selected, .select-items`);
        elements.forEach((e) => e.remove());
    }

    create_select_container(select_element: HTMLSelectElement, container: Element) {
        const select_selected = document.createElement("div");
        select_selected.setAttribute("class", "select-selected");
        select_selected.innerHTML = select_element.options[select_element.selectedIndex].innerHTML;
        container.appendChild(select_selected);

        const select_items = document.createElement("div");
        select_items.setAttribute("class", "select-items select-hide");
        container.appendChild(select_items);

        return { select_selected, select_items };
    }

    create_option_item(option: HTMLElement, select_items: HTMLElement, select_element: HTMLSelectElement) {
        const option_item = document.createElement("div");
        option_item.innerHTML = option.innerHTML;
        option_item.addEventListener("click", (e) => this.handle_option_click(e, select_element, option_item, select_items));
        select_items.appendChild(option_item);
    }

    handle_option_click(e: MouseEvent, select_element: HTMLSelectElement, option_item: HTMLElement, select_items: HTMLElement) {
        const select_box = select_element;
        const selected_index = Array.from(select_box.options).findIndex(opt => opt.innerHTML === option_item.innerHTML);
        select_box.selectedIndex = selected_index;
        const no_replace = select_box.hasAttribute(`no-replace`);

        // Trigger change event on native select
        select_box.dispatchEvent(new Event("change"));

        if (!no_replace) {
            const header = select_items.previousElementSibling as HTMLElement;
            header.innerHTML = option_item.innerHTML;
            this.update_selected_class(option_item, select_items);
        }

        //header.click();
    }

    update_selected_class(option_item: HTMLElement, select_items: HTMLElement) {
        const same_as_selected = select_items.getElementsByClassName("same-as-selected");
        for (let k = 0; k < same_as_selected.length; k++) {
            same_as_selected[k].removeAttribute("class");
        }
        option_item.setAttribute("class", "same-as-selected");
    }

    add_select_event_listeners(select_selected: HTMLElement, select_items: HTMLElement) {
        select_selected.addEventListener("click", (e) => this.handle_select_click(e, select_selected, select_items));
    }

    handle_select_click(e: MouseEvent, select_selected: HTMLElement, select_items: HTMLElement) {
        e.stopPropagation();
        this.close_all_select(select_selected);
        select_items.classList.toggle("select-hide");
        select_selected.classList.toggle("select-arrow-active");
    }

    close_all_select(elmnt: HTMLElement) {
        const select_items = document.getElementsByClassName("select-items");
        const select_selected = document.getElementsByClassName("select-selected");
        const arr_no: number[] = [];

        for (let i = 0; i < select_selected.length; i++) {
            if (elmnt === select_selected[i]) {
                arr_no.push(i);
            } else {
                select_selected[i].classList.remove("select-arrow-active");
            }
        }

        for (let i = 0; i < select_items.length; i++) {
            if (!arr_no.includes(i)) {
                select_items[i].classList.add("select-hide");
            }
        }
    }

    build_selects() {
        this.clear_selects();

        const select_elements = document.getElementsByClassName("custom-select");
        for (let i = 0; i < select_elements.length; i++) {
            const select_element = select_elements[i].getElementsByTagName("select")[0];
            const container = select_elements[i];
            const { select_selected, select_items } = this.create_select_container(select_element, container);

            const start = container.hasAttribute(`no-header`) ? 0 : 1;
            for (let j = start; j < select_element.length; j++) {
                this.create_option_item(select_element.options[j], select_items, select_element);
            }

            this.add_select_event_listeners(select_selected, select_items);
        }
    }
}
