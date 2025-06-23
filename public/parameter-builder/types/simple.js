import {ParameterBuilder, DataType} from "../ParameterBuilder.js";

export function simple_type(parameter, root_container) {
    const input_container = document.createElement('div');
    input_container.classList.add('input-container', 'type-container', 'simple-type');
    input_container.setAttribute("data-type", parameter.type);

    const input = document.createElement('input');
    input.type = parameter.type.toLowerCase() === DataType.STRING_TYPE.name.toLowerCase() ? 'text': 'number' ;
    input.placeholder = parameter.type;

    // argument display construction
    // simple_tag content is the input value, plus decorations if needed.
    const simple_tag = document.createElement(parameter.type.toLowerCase());
    const quote = document.createElement("quote");
    quote.textContent = `\"`;

    const content = document.createElement("content");
    content.textContent = input.value;

    if(parameter.type.toLowerCase() === DataType.STRING_TYPE.name.toLowerCase()) {
        simple_tag.appendChild(quote);
    }
    simple_tag.appendChild(content);

    if(parameter.type.toLowerCase() === DataType.STRING_TYPE.name.toLowerCase()) {
        simple_tag.appendChild(quote.cloneNode(true));
    }

    input.addEventListener("change", () => {
        content.textContent = input.value;

        const pbi_did_change_event = new CustomEvent("pb-input-did-change", {
            detail: {
                text: content.textContent,
            },
        });

        document.dispatchEvent(pbi_did_change_event);
    });

    input_container.appendChild(input);

    root_container.appendChild(input_container);

    return simple_tag;

}