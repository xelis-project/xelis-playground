// type:schema
import { array_type } from "./types/array";
import { simple_type } from "./types/simple";
import { map_type } from "./types/map";
import { struct_type } from "./types/struct";
import { opaque_type } from "./types/opaque";
import { enum_type } from "./types/enum";
import { boolean_type } from "./types/boolean";
import { DataType } from "./data_type";
import { Parameter } from "./xvm_param_parser";

interface ParameterBuilderOptions {
    pb_container: HTMLElement;
    arg_container: HTMLElement;
}

export class ParameterBuilder {
    static create(parameter: Parameter, root_container: HTMLElement) {
        switch (parameter.type.toLowerCase()) {
            case DataType.ARRAY_TYPE.name.toLowerCase():
                return array_type(parameter, root_container);
            case DataType.ENUM_TYPE.name.toLowerCase():
                return enum_type(parameter, root_container);
            case DataType.MAP_TYPE.name.toLowerCase():
                return map_type(parameter, root_container);
            case DataType.STRUCT_TYPE.name.toLowerCase():
                return struct_type(parameter, root_container);
            case DataType.OPAQUE_TYPE.name.toLowerCase():
                return opaque_type(parameter, root_container);
            case DataType.BOOL_TYPE.name.toLowerCase():
            case "bool":  // TODO: alias?
                return boolean_type(parameter, root_container);
            default:
                return simple_type(parameter, root_container);
        }
    }

    static build_from_schema(parameter_schema: Parameter[], options?: ParameterBuilderOptions) {
        let pb_container = null;
        let arg_container = null;

        if (options && options.hasOwnProperty('pb_container') && options.hasOwnProperty('arg_container')) {
            pb_container = options.pb_container;
            arg_container = options.arg_container;
        } else {
            pb_container = document.getElementById('parameter-builder')!;
            arg_container = document.getElementById('arguments-container')!;
        }

        // flush containers
        pb_container.replaceChildren();
        arg_container.replaceChildren();

        let args_list = [] as HTMLPreElement[];

        parameter_schema.forEach((p, index) => {
            const param_container = document.createElement('div');

            param_container.classList.add('param-container');
            const header = document.createElement('p');
            header.classList.add('parameter-header');
            header.innerHTML = `Parameter: #${++index}: <span>${p.name}</span>`;
            param_container.appendChild(header);
            pb_container.appendChild(param_container);

            const arg_wrapper = document.createElement('pre');
            const arg_build = ParameterBuilder.create(p, param_container);
            arg_wrapper.appendChild(arg_build);
            /* when we get input changes, we report it so that any additional argument displays can be updated */
            document.addEventListener('pb-input-did-change', (e) => {
                const pba_did_change_event = new CustomEvent("pb-argument-did-change", {
                    detail: {
                        arg_container: arg_container,
                    },
                });

                document.dispatchEvent(pba_did_change_event);
            });

            args_list.push(arg_wrapper);
        });

        let len = 1;
        args_list.forEach(a => {
            arg_container.appendChild(a);
            const comma = len < args_list.length ? document.createTextNode(', ') : document.createTextNode('');
            arg_container.appendChild(comma);
            len++;
        });
    }
}
