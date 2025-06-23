/* TODO: replace schema_keys with new silex json format values */
export class DataType {
    static U8_TYPE = Object.freeze({ name: "u8", schema_keys: [] });
    static U16_TYPE = Object.freeze({ name: "U16", schema_keys: [] });
    static U32_TYPE = Object.freeze({ name: "U32", schema_keys: [] });
    static U64_TYPE = Object.freeze({ name: "U64", schema_keys: [] });
    static BOOL_TYPE = Object.freeze({ name: "boolean", schema_keys: [] });
    static CHAR_TYPE = Object.freeze({ name: "char", schema_keys: [] });
    static STRING_TYPE = Object.freeze({ name: "string", schema_keys: [] });
    static ARRAY_TYPE = Object.freeze({ name: "array", schema_keys: ["item"] });
    static ENUM_TYPE = Object.freeze({ name: "enum", schema_keys: ["variants"] });
    static MAP_TYPE = Object.freeze({ name: "map", schema_keys: ["key", "value"] });
    static STRUCT_TYPE = Object.freeze({ name: "struct", schema_keys: ["fields"] });
}
