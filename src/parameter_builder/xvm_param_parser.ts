import { Entry } from "../../public/xelis_playground";

export interface Parameter {
    name: string;
    type: string;
    signature: string;
    value: any;
}

interface PbObject {
    id: number;
    name: string;
    parameters: Parameter[];
}

export class XVMParamParser {
    parameter_builder_data: PbObject[];

    constructor() {
        this.parameter_builder_data = [];
        //window.raw_entries = [];
    }

    /* Deprecated. This was used to parse a non-JSON formatted signature*/
    signature_to_json(signature: string) {
        const _thisParser = this;

        let out = Object.create(null);
        //out.status = "OK";

        const MAP_TYPE = 'map';
        const ARRAY_TYPE = 'array';
        const STRUCT_TYPE = 'struct';

        /* arrays are not beautifully shaped - u8[], string[], etc.*/
        const ugly_array_regex = /^(.+)\[]$/;
        if (ugly_array_regex.test(signature)) {
            signature = signature.replace(ugly_array_regex, "$1");

            out.type = ARRAY_TYPE;
            out.schema = Object.create(null);

            out.schema.item = _thisParser.signature_to_json(signature);
            return out;
        }

        const regex = /^(u\d+\s*$|string\s*$|boolean\s*$|map|array\(|struct\(StructType\(Struct)/gi;
        const sig = signature.trim().match(regex);

        if (sig === null) {
            out.type = "unknown";
            out.schema = null;
            out.status = "Unknown type";
            return out;
        }

        switch (true) {
            case sig[0].toLowerCase().startsWith(MAP_TYPE):
                out.type = MAP_TYPE;
                out.schema = Object.create(null);

                const map_regex = /^map[<(]+([a-zA-Z0-9]+),\s*(.+)[>)]$/i;
                const kv_sig = signature.trim().match(map_regex);
                if (kv_sig) {
                    if (![STRUCT_TYPE, ARRAY_TYPE, MAP_TYPE].includes(kv_sig[1])) {
                        out.schema.key = _thisParser.signature_to_json(kv_sig[1]);
                    } else {
                        out.schema.status = `Error. Maps cannot have an ${kv_sig[1]} key.`;
                    }

                    out.schema.value = _thisParser.signature_to_json(kv_sig[2]);
                }
                break;
            case sig[0].toLowerCase().startsWith(STRUCT_TYPE):
                out.type = STRUCT_TYPE;
                out.schema = Object.create(null);

                // NTS: this is the root level of the parameter.
                const struct_regex = /^struct\(StructType\(Struct\s*(.+)\)\)/i;
                const struct_sig = signature.trim().match(struct_regex);

                if (struct_sig !== null) {
                    const struct_internal_regex = /\{\s*id:\s*(\d+),\s*fields:\s*\[(.+)]\s*}/i;
                    const struct_internal_sig = struct_sig[1].trim().match(struct_internal_regex);

                    if (struct_internal_sig === null) {
                        const bad_struct_info = Object.create(null);
                        bad_struct_info.name = "malformed_struct";
                        bad_struct_info.type = 'malformed';
                        bad_struct_info.status = `STRUCT ERROR: ${out.type} is not well formed. -> ${struct_sig[1]}`;
                        bad_struct_info.schema = Object.create(null);
                        out = bad_struct_info;
                        return out;
                    }

                    out.id = struct_internal_sig[1];
                    out.schema.fields = [];

                    let fields = struct_internal_sig[2];

                    let field_types = [];

                    while (fields.trim().length > 0) {
                        /** Find primitive types, start of compound types, and arrays of primitive types.
                         // Worth noting that primitive type arrays (P) in compound types use 'Array<P>', not P[]. **/
                        const field_regex = /^(((u\d+|string|boolean)(\[])*)|(map|array|struct)),*\s*/i;

                        const f = fields.trim().match(field_regex);
                        //console.log(f);
                        if (f !== null) {
                            switch (true) {
                                case f[0].toLowerCase().startsWith(MAP_TYPE):
                                case f[0].toLowerCase().startsWith(ARRAY_TYPE):
                                case f[0].toLowerCase().startsWith(STRUCT_TYPE):
                                    //console.log("field is compound. PARSE.");
                                    //console.log(f[0].toLowerCase());

                                    let type = f[0];
                                    let paren_count_count = 0;
                                    const brace_type_open = "(";
                                    const brace_type_close = ")";

                                    for (let i = type.length; i < fields.length; i++) {
                                        type += fields[i];

                                        if (fields[i] === brace_type_open) {
                                            paren_count_count++;
                                        }
                                        if (fields[i] === brace_type_close) {
                                            paren_count_count--;
                                        }

                                        if (paren_count_count === 0) {
                                            break;
                                        }
                                    }

                                    if (paren_count_count !== 0) {   // fields exhausted, but the field type is not closed.
                                        console.error(`STRUCT FIELD ERROR: ${type} is not closed. -> ${fields}`);
                                        const bad_struct_info = Object.create(null);
                                        bad_struct_info.name = "malformed_struct_field";
                                        bad_struct_info.type = 'malformed';
                                        bad_struct_info.status = `STRUCT FIELD ERROR: ${type} is not closed. -> ${fields}`;
                                        bad_struct_info.schema = Object.create(null);
                                        out.schema.fields.push(bad_struct_info);

                                        return out;
                                    }

                                    field_types.push(type);

                                    // remove the type from the fields
                                    fields = fields.slice(type.length);
                                    if (fields.trim().length > 0) {
                                        fields = fields.replace(/^[\s*,]+/, "");
                                    }

                                    break;
                                default:
                                    const this_field_type = f[0].toLowerCase().trim().replace(",", "").trim();
                                    fields = fields.slice(f[0].length);
                                    field_types.push(this_field_type);

                                    break;
                            }
                        }
                    }

                    //console.log(`field_types: ${field_types}`);

                    field_types.forEach((field_type, index) => {
                        let f_info = _thisParser.signature_to_json(field_type);
                        f_info.name = "field_" + index;   // TODO: Temporary. publisher: -- signature needs to include the field name.
                        out.schema.fields.push(f_info);
                    });
                }
                break;
            case sig[0].toLowerCase().startsWith(ARRAY_TYPE):
                out.type = ARRAY_TYPE;
                out.schema = Object.create(null);

                // NTS: this is the root level of the parameter.
                const array_regex = /^array\((.+)\)$/i;
                const array_sig = signature.trim().match(array_regex);
                if (array_sig) {
                    out.schema.item = _thisParser.signature_to_json(array_sig[1]);
                }
                break;
            default:
                out.type = sig[0];
                out.schema = null;
        }

        return out;
    }


    make_schema_from_entry(entry: Entry) {
        let pb_obj = {
            id: entry.id(),
            name: entry.name(),
            parameters: [] as Parameter[]
        };

        entry.parameters().forEach(p => {
            const parameter_type = p.type_json().type;
            const parameter_value = p.type_json().value;
            pb_obj.parameters.push({ name: p.name(), signature: p.type_name(), type: parameter_type, value: parameter_value });
        });

        this.parameter_builder_data.push(pb_obj);

        //window.raw_entries.push(entry);
        //window.pb_entries = this.parameter_builder_data;
    }
}
