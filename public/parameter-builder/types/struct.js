import {ParameterBuilder} from "../ParameterBuilder.js";

export function struct_type(parameter, root_container) {
    const struct_container = document.createElement('div');
    struct_container.classList.add('struct-container', 'type-container', 'compound-type');
    struct_container.setAttribute("data-type", "struct");

    const type_label = document.createElement('p');
    type_label.classList.add('type-label');
    type_label.textContent = `struct (${parameter.value.fields.length} fields)`;
    struct_container.appendChild(type_label);

    // add the struct container to the argument display
    const struct_tag = document.createElement(parameter.type.toLowerCase());
    const open_brace = document.createElement("open-brace");
    open_brace.textContent = "{";
    const close_brace = document.createElement("close-brace");
    close_brace.textContent = "}";
    const content = document.createElement("content");

    struct_tag.appendChild(open_brace);
    struct_tag.appendChild(content);
    struct_tag.appendChild(close_brace);

    parameter.value.fields.forEach((f, idx) => {
        const index = idx+1;
        //console.log(`struct field at index ${index}: ${f.type}`);

        const field_label = document.createElement(`field`);
        field_label.setAttribute("data-index", `${index}`);
        field_label.textContent = `${f[0]}: `;
        content.appendChild(field_label);

        const field_tag = ParameterBuilder.create(f[1], struct_container);
        content.appendChild(field_tag);

        if(index < parameter.value.fields.length) {
            const comma = document.createElement("comma");
            comma.textContent = ", ";
            content.appendChild(comma);
        }

    });

    struct_container.style.margin = '20px 0px';

    root_container.appendChild(struct_container);
    return struct_tag;
}
