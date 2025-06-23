import { ParameterBuilder } from "../parameter_builder.js";
import { Parameter } from "../xvm_param_parser.js";

export function array_type(parameter: Parameter, root_container: HTMLElement) {
    const array_container = document.createElement('div');
    array_container.classList.add('array-container', 'type-container', 'compound-type');
    array_container.setAttribute("data-type", "array");

    const type_label = document.createElement('p');
    type_label.classList.add('type-label');
    type_label.textContent = `array [${parameter.value.type}]`;
    array_container.appendChild(type_label);

    const add_btn = document.createElement('div');
    add_btn.classList.add("opt-btn", "green", "add-btn");
    add_btn.textContent = "Add Item";
    array_container.appendChild(add_btn);

    // add the array container to the argument display
    const array_tag = document.createElement(parameter.type.toLowerCase());

    const open_bracket = document.createElement("open-bracket");
    open_bracket.textContent = "[";
    const close_bracket = document.createElement("close-bracket");
    close_bracket.textContent = "]";
    const content = document.createElement("content");

    array_tag.appendChild(open_bracket);
    array_tag.appendChild(content);
    array_tag.appendChild(close_bracket);

    function make_array_item() {
        // create a_container to hold the array item and it's removal button.
        const item_container = document.createElement('div');
        item_container.classList.add('array-item-container');
        item_container.setAttribute("data-container", "array-item-container");
        array_container.appendChild(item_container);

        const item_content = ParameterBuilder.create(parameter.value, item_container);

        if (content.firstChild !== null) {
            const comma = document.createElement("comma");
            comma.textContent = ", ";
            content.appendChild(comma);
        }
        content.appendChild(item_content);

        /** remove button **/
        const remove_btn = document.createElement('div');
        remove_btn.classList.add("opt-btn", "mixed");
        remove_btn.textContent = "-";

        switch (item_container.getAttribute("data-type")) {
            case "array": {
                remove_btn.textContent = "remove array";
                break;
            }
            case "struct": {
                remove_btn.textContent = "remove struct";
                break;
            }
            case "map": {
                remove_btn.textContent = "remove map";
                break;
            }
            default: {
                if (item_container.getAttribute("data-container") === 'map-kv-container') {
                    remove_btn.textContent = 'del';
                }
                break;
            }
        }

        item_container.appendChild(remove_btn);

        remove_btn.addEventListener("click", () => {

            if (content.firstChild === item_content) {
                if (item_content.nextSibling !== null && item_content.nextSibling.nodeName.toLowerCase() === 'comma') {
                    content.removeChild(item_content.nextSibling);
                }
            } else {
                const maybe_comma = item_content.previousSibling;
                if (maybe_comma !== null && maybe_comma.nodeName.toLowerCase() === 'comma') {
                    maybe_comma.remove();
                }
            }

            content.removeChild(item_content);
            array_container.removeChild(item_container);
        });

        /** end remove button **/
    }

    add_btn.addEventListener("click", () => {
        make_array_item();
    });

    // render first item
    make_array_item();

    root_container.appendChild(array_container);

    return array_tag;
}