import { ParameterBuilder } from "../parameter_builder";
import { Parameter } from "../xvm_param_parser";

export function enum_type(parameter: Parameter, root_container: HTMLElement) {
    const enum_container = document.createElement('div');
    enum_container.classList.add('enum-container', 'type-container', 'compound-type');
    enum_container.setAttribute("data-type", "enum");

    const type_label = document.createElement('p');
    type_label.classList.add('type-label');
    type_label.textContent = `enum ${parameter.value.name}`;
    enum_container.appendChild(type_label);

    /* Argument Display */
    const enum_tag = document.createElement(parameter.type.toLowerCase());
    const content = document.createElement("content");
    enum_tag.appendChild(content);

    const select_menu = document.createElement('select');
    const newOption = document.createElement("option");
    newOption.text = "-";
    newOption.value = "";
    select_menu.appendChild(newOption);

    parameter.value.variants.forEach((variant: string[], index: number) => {
        const variant_option = document.createElement("option");
        variant_option.text = variant[0];
        variant_option.value = index.toString();
        select_menu.appendChild(variant_option);
    });

    select_menu.addEventListener("change", (e) => {
        content.replaceChildren();

        // TODO: cleanup ro_display
        if (!e.target) {
            return;
        }

        const target = e.target as HTMLSelectElement;
        const index = target.value;
        if(index === "") {
            return;
        }

        // enum Type name
        const enum_type = document.createElement("enum-type");
        enum_type.textContent = parameter.value.name;
        content.appendChild(enum_type);

        const double_colon = document.createElement("double-colon");
        double_colon.textContent = "::";
        enum_type.appendChild(double_colon);

        const variant = parameter.value.variants[parseInt(index)];
        //console.log("debug: enum variant field name -: " + variant[0])

        let variant_tag = document.createElement("variant");
        const variant_name = document.createElement("variant-name");
        variant_name.textContent = variant[0];
        variant_tag.appendChild(variant_name);

        if(variant[1].length > 0) {
            const open_brace = document.createElement("open-brace");
            open_brace.textContent = "{";
            const close_brace = document.createElement("close-brace");
            close_brace.textContent = "}";

            variant_tag.appendChild(open_brace);

            variant[1].forEach((vf: any, index: number) => {
                const field_label = document.createElement(`field`);
                field_label.textContent = `${vf[0]}: `;
                variant_tag.appendChild(field_label);

                const field_tag = ParameterBuilder.create(vf[1], enum_container);
                variant_tag.appendChild(field_tag);

                if(index < variant[1].length - 1) {
                    const comma = document.createElement("comma");
                    comma.textContent = ", ";
                    variant_tag.appendChild(comma);
                }
            });

            variant_tag.appendChild(close_brace);
        }

        content.appendChild(variant_tag);
    });

    enum_container.style.margin = '20px 0px';

    enum_container.appendChild(select_menu);
    root_container.appendChild(enum_container);
    return enum_tag;
}
