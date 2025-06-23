import { ParameterBuilder } from "../parameter_builder";
import { Parameter } from "../xvm_param_parser";

export function map_type(parameter: Parameter, root_container: HTMLElement) {
    const map_container = document.createElement('div');
    map_container.classList.add('map-container', 'type-container', 'compound-type');
    map_container.setAttribute("data-type", "map");

    const type_label = document.createElement('p');
    type_label.classList.add('type-label');
    type_label.textContent = parameter.signature;
    map_container.appendChild(type_label);

    if(["map", "struct"].includes(parameter.value[0].type.toLowerCase())) {
        console.log(`map key error: ${parameter.type} is not a valid type`);
        map_container.textContent = `map key error: ${parameter.type} is not a valid type`;
        map_container.style.color = 'red';
        root_container.appendChild(map_container);
        return document.createElement(`div`);
    }

    const add_btn = document.createElement('div');
    add_btn.classList.add("opt-btn",  "green", "add-btn");
    add_btn.textContent = "Add Key/Value Pair";
    map_container.appendChild(add_btn);

    // add the map container to the argument display
    const map_tag = document.createElement(parameter.type.toLowerCase());
    const open_brace = document.createElement("open-brace");
    open_brace.textContent = "{";
    const close_brace = document.createElement("close-brace");
    close_brace.textContent = "}";
    const content = document.createElement("content");

    map_tag.appendChild(open_brace);
    map_tag.appendChild(content);
    map_tag.appendChild(close_brace);

    function make_kv_pair() {
        // create a_container to hold the kv pair.
        const kv_container = document.createElement('div');
        kv_container.classList.add('kv-container');
        kv_container.setAttribute("data-container", "map-kv-container");
        map_container.appendChild(kv_container);

        const pair_tag = document.createElement("pair");
        const key_tag = ParameterBuilder.create(parameter.value[0], kv_container);
        const value_tag = ParameterBuilder.create(parameter.value[1], kv_container);

        pair_tag.appendChild(key_tag);
        pair_tag.appendChild(document.createTextNode(":"));
        pair_tag.appendChild(value_tag);

        if(content.firstChild !== null) {
            const comma = document.createElement("comma");
            comma.textContent = ", ";
            content.appendChild(comma);
        }

        content.appendChild(pair_tag);

        /** remove button **/
        const remove_btn = document.createElement('div');
        remove_btn.classList.add("opt-btn",  "mixed");
        remove_btn.textContent = "-";

        switch (kv_container.getAttribute("data-type")) {
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
                if(kv_container.getAttribute("data-container") === 'map-kv-container') {
                    remove_btn.textContent = 'del';
                }
                break;
            }
        }

        kv_container.appendChild(remove_btn);

        remove_btn.addEventListener("click", () => {

            if(content.firstChild === pair_tag) {
                if(pair_tag.nextSibling !== null && pair_tag.nextSibling.nodeName.toLowerCase() === 'comma') {
                    content.removeChild(pair_tag.nextSibling);
                }
            } else {
                const maybe_comma = pair_tag.previousSibling;
                if(maybe_comma !== null && maybe_comma.nodeName.toLowerCase() === 'comma') {
                    maybe_comma.remove();
                }
            }

            content.removeChild(pair_tag);
            map_container.removeChild(kv_container);
        });

        /** end remove button **/
    }

    add_btn.addEventListener("click", () => {
        make_kv_pair();
    });

    // render the first key/value pair
    make_kv_pair();

    root_container.appendChild(map_container);

    return map_tag;
}