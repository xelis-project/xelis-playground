import { Parameter } from "../xvm_param_parser";

export function boolean_type(parameter: Parameter, root_container: HTMLElement) {
    const input_container = document.createElement('div');
    input_container.classList.add('input-container', 'type-container', 'boolean-type');
    input_container.setAttribute("data-type", parameter.type);

    const input = document.createElement('input');
    input.type = 'checkbox' ;

    // argument display construction
    const bool_tag = document.createElement(parameter.type.toLowerCase());
    const content = document.createElement("content");
    content.textContent = "false";  // default
    bool_tag.appendChild(content);

    input.addEventListener("change", () => {
        content.textContent = input.checked ? 'true' : 'false';
    });

    input_container.appendChild(input);

    root_container.appendChild(input_container);

    return bool_tag;
}