import { DataType } from "../data_type";
import { ParameterBuilder } from "../parameter_builder";
import { Parameter } from "../xvm_param_parser";

export function opaque_type(parameter: Parameter, root_container: HTMLElement) {

    const opaque_name = parameter.value.name;

    const opaque_container = document.createElement('div');
    opaque_container.classList.add(`${opaque_name}-container`, 'type-container', 'opaque-type');
    opaque_container.setAttribute("data-type", "opaque");

    const type_label = document.createElement('p');
    type_label.classList.add('type-label');
    type_label.textContent = opaque_name;
    opaque_container.appendChild(type_label);

    // add the opaque container to the argument display
    const otype_tag = document.createElement(opaque_name.toLowerCase());
    const content = document.createElement("content");
    otype_tag.appendChild(content);

    switch (opaque_name.toLowerCase()) {
        case "address":
        case "hash":
            // const string_type = {name: DataType.STRING_TYPE.name, type: DataType.STRING_TYPE.name, signature: DataType.STRING_TYPE.name, value: null};
            // const string_tag = ParameterBuilder.create(string_type, opaque_container);
            // content.appendChild(string_tag);

            const input = document.createElement('textarea');
            input.placeholder = opaque_name;
            input.setAttribute("autocomplete", "off");
            input.setAttribute("autocorrect", "off");
            input.setAttribute("autocapitalize", "off");
            input.setAttribute("spellcheck", "false");
            content.textContent = input.value;

            input.addEventListener("change", () => {
                content.textContent = input.value;

                const pbi_did_change_event = new CustomEvent("pb-input-did-change", {
                    detail: {
                        text: content.textContent,
                    },
                });

                document.dispatchEvent(pbi_did_change_event);
            });

            input.addEventListener('keydown', (e) => {
                let key = e.key;

                if(e.key === 'Enter') {
                    e.preventDefault();
                    return false;
                }

                // TODO: address character validation on paste.
                if(opaque_name.toLowerCase() === "address" && !/^[A-Za-z0-9:]+$/.test(e.key)) {
                    // Returning false will not write it to the textarea
                    e.preventDefault();
                    return false;
                }

                //TODO: hash character validation.
            });

            opaque_container.appendChild(input);

            break;
        default:
            console.log(`Unknown opaque type ${opaque_name}`);
            break
    }

    opaque_container.style.margin = '20px 0px';
    root_container.appendChild(opaque_container);

    // This content element is for consistency with other types that all have a content element as a first child
    const ope_content = document.createElement("content");
    ope_content.appendChild(otype_tag);

    const opaque_elem = document.createElement("opaque");
    opaque_elem.appendChild(ope_content);
    return opaque_elem;
}
