// type:schema
import {array_type} from "./types/array.js";
import {simple_type} from "./types/simple.js";
import {map_type} from "./types/map.js";
import {struct_type} from "./types/struct.js";
import {enum_type} from "./types/enum.js";
import {boolean_type} from "./types/boolean.js";

/* TODO: replace schema_keys with new silex json format values */
export class DataType {
    static U8_TYPE      = Object.freeze({name: "u8", schema_keys: []});
    static U16_TYPE     = Object.freeze({name: "U16", schema_keys: []});
    static U32_TYPE     = Object.freeze({name: "U32", schema_keys: []});
    static U64_TYPE     = Object.freeze({name: "U64", schema_keys: []});
    static BOOL_TYPE    = Object.freeze({name: "boolean", schema_keys: []});
    static CHAR_TYPE    = Object.freeze({name: "char", schema_keys: []});
    static STRING_TYPE  = Object.freeze({name: "string", schema_keys: []});
    static ARRAY_TYPE   = Object.freeze({name: "array", schema_keys: ["item"]});
    static ENUM_TYPE   = Object.freeze({name: "enum", schema_keys: ["variants"]});
    static MAP_TYPE     = Object.freeze({name: "map", schema_keys: ["key", "value"]});
    static STRUCT_TYPE  = Object.freeze({name: "struct", schema_keys: ["fields"]});
}

export class ParameterBuilder {
    static create(parameter, root_container) {

        switch (parameter.type.toLowerCase()) {
            case DataType.ARRAY_TYPE.name.toLowerCase():
                return array_type(parameter, root_container);
            case DataType.ENUM_TYPE.name.toLowerCase():
                return enum_type(parameter, root_container);
            case DataType.MAP_TYPE.name.toLowerCase():
                return map_type(parameter, root_container);
            case DataType.STRUCT_TYPE.name.toLowerCase():
                return struct_type(parameter, root_container);
            case DataType.BOOL_TYPE.name.toLowerCase():
            case "bool":  // TODO: alias?
                return boolean_type(parameter, root_container);
            default:
                return simple_type(parameter, root_container);
        }
    }

    static build_from_schema(parameter_schema, _options) {
        const pb_opts = _options || null;
        let pb_container = null;
        let arg_container = null;

        if(pb_opts !== null && pb_opts.hasOwnProperty('pb_container') && pb_opts.hasOwnProperty('arg_container')) {
            pb_container = pb_opts.pb_container;
            arg_container = pb_opts.arg_container;
        } else {
            pb_container = document.getElementById('parameter-builder');
            arg_container = document.getElementById('arguments-container');
        }

        // flush containers
        pb_container.replaceChildren();
        arg_container.replaceChildren();

        let args_list = [];

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
            const comma =  len < args_list.length ? document.createTextNode(', ') : document.createTextNode('');
            arg_container.appendChild(comma);
            len++;
        });
    }
}


