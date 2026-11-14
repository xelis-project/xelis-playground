
import type { RPCInspector } from "./index";

export interface Schema {
    $schema?: string;
    title?: string;
    type?: string | string[];
    properties?: { [key: string]: Schema };
    required?: string[];
    $defs?: { [key: string]: Schema };
    $ref?: string;
    oneOf?: Schema[];
    anyOf?: Schema[];
    items?: Schema;
    enum?: any[];
    format?: string;
    minimum?: number;
    maximum?: number;
    default?: any;
    description?: string;
    additionalProperties?: boolean | Schema;
}

export interface RPCMethodSchema {
    name: string;
    method_id: number;
    schema: {
        params_schema: Schema | null;
        returns_schema: Schema | null;
    };
}

export function schemaHasParams(schema: Schema | null): boolean {
    if (!schema) return false;
    if (schema.properties && Object.keys(schema.properties).length > 0) return true;
    if (schema.oneOf && schema.oneOf.length > 0) return true;
    if (schema.anyOf && schema.anyOf.length > 0) return true;
    if (schema.$ref) return true;
    if (schema.type && schema.type !== 'object' && schema.type !== 'null') return true;
    return false;
}

export function generateDefaultParams(schema: Schema | null, definitions: { [key: string]: Schema } = {}): any {
    if (!schema) return undefined;

    if (schema.$ref) {
        const refName = schema.$ref.replace('#/$defs/', '');
        const refSchema = definitions[refName];
        if (refSchema) {
            return generateDefaultParams(refSchema, definitions);
        }
        return undefined;
    }

    if (schema.oneOf && schema.oneOf.length > 0) {
        return generateDefaultParams(schema.oneOf[0], definitions);
    }

    if (schema.anyOf && schema.anyOf.length > 0) {
        return generateDefaultParams(schema.anyOf[0], definitions);
    }

    if (schema.enum && schema.enum.length > 0) {
        return schema.default !== undefined ? schema.default : schema.enum[0];
    }

    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    if (type === 'object' || schema.properties) {
        const obj: any = {};
        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const val = generateDefaultParams(propSchema, definitions);
                if (val !== undefined) {
                    obj[key] = val;
                }
            }
        }
        return obj;
    }

    if (type === 'array') {
        if (schema.items) {
            const itemVal = generateDefaultParams(schema.items, definitions);
            return itemVal !== undefined ? [itemVal] : [];
        }
        return [];
    }

    if (type === 'string') {
        return schema.default !== undefined ? schema.default : "";
    }

    if (type === 'integer' || type === 'number') {
        if (schema.default !== undefined) return schema.default;
        if (schema.minimum !== undefined) return schema.minimum;
        return 0;
    }

    if (type === 'boolean') {
        return schema.default !== undefined ? schema.default : false;
    }

    return undefined;
}

export class ApiUI {
    methods: RPCMethodSchema[] = [];
    private container: HTMLElement;
    private methodUIContainer: HTMLElement;
    private currentMethod: RPCMethodSchema | null = null;

    private data_rpc_id: string;
    private rpcInspector: RPCInspector | null = null;

    constructor(
        schemaResult: RPCMethodSchema[],
        endpoint: string = "daemon",
        use_list: boolean = false,
        data_rpc_id: string,
        container: HTMLElement,
        rpcInspector?: RPCInspector
    ) {
        this.data_rpc_id = data_rpc_id;
        this.methods = schemaResult;
        this.container = container;
        this.rpcInspector = rpcInspector || null;

        this.container.classList.add('api-ui-container');

        this.methodUIContainer = document.createElement('div');
        this.methodUIContainer.className = 'api-method-ui';

        this.container.appendChild(this.methodUIContainer);

        this.renderMethodList(endpoint, use_list);
    }

    private renderMethodList(endpoint: string, use_list: boolean = false) {
        if(!use_list) {
            const ul = document.createElement('ul');
            this.methods.forEach(method => {
                const li = document.createElement('li');
                li.textContent = method.name;
                li.style.cursor = 'pointer';
                li.onclick = () => this.selectMethod(method);
                ul.appendChild(li);
            });
            return;
        }

        this.methods.forEach(method => {
            const selector = `[data-rpc-id="${this.data_rpc_id}"] .rpc-api-item[data-cmd="${method.name}"]`;
            const method_link = document.querySelector(selector) as HTMLElement;
            if(method_link === null) {
                console.log(`ERROR: Method ${method.name} not found in the DOM for rpc-id ${this.data_rpc_id}. Skipping.`);
                return;
            }

            method_link.onclick = () => this.selectMethod(method);
        });
    }

    public selectMethod(method: RPCMethodSchema) {
        this.currentMethod = method;
        const rootSchema = method.schema.params_schema;
        const definitions = rootSchema?.$defs || {};
        const hasParams = schemaHasParams(rootSchema);

        const query_input = document.querySelector(`.rpc-inspector-header-section[data-rpc-id="${this.data_rpc_id}"] .rpc_query`) as HTMLDivElement;
        const btn_edit_method = document.querySelector(`[data-rpc-id="${this.data_rpc_id}"] .btn-edit-method-input`) as HTMLButtonElement;
        const btn_method_json_container = document.querySelector(`[data-rpc-id="${this.data_rpc_id}"] .btn-method-json-container`) as HTMLElement;

        if (btn_edit_method) btn_edit_method.classList.add('hide');
        if (btn_method_json_container) btn_method_json_container.classList.add('hide');
        this.container.classList.add('hide');

        if (!hasParams) {
            const api_cmd_required = `"id": ${method.method_id}, "jsonrpc": "2.0", "method": "<function>${method.name}</function>"`;
            if (query_input) {
                query_input.innerHTML = `{${api_cmd_required}}`;
                query_input.classList.remove('hide');
            }

            if (this.rpcInspector) {
                this.rpcInspector.send_rpc_query();
            }
        } else {
            const defaultParams = generateDefaultParams(rootSchema, definitions) ?? {};
            const api_cmd_required = `"id": ${method.method_id}, "jsonrpc": "2.0", "method": "<function>${method.name}</function>"`;
            if (query_input) {
                query_input.innerHTML = `{${api_cmd_required}, "params": ${JSON.stringify(defaultParams, null, 2)}}`;
                query_input.classList.remove('hide');
            }
        }
    }

    public updateQueryInputFromForm() {
        if (!this.currentMethod) return;
        const data = this.getFormData();
        const api_cmd_required = `"id": ${this.currentMethod.method_id}, "jsonrpc": "2.0", "method": "<function>${this.currentMethod.name}</function>"`;
        const query_input = document.querySelector(`.rpc-inspector-header-section[data-rpc-id="${this.data_rpc_id}"] .rpc_query`) as HTMLDivElement;
        if (query_input) {
            query_input.innerHTML = `{${api_cmd_required}, "params": ${JSON.stringify(data, null, 2)}}`;
        }
    }

    private renderMethodUI(method: RPCMethodSchema) {
        this.methodUIContainer.innerHTML = '';

        const hdr_container = document.createElement('div');
        hdr_container.classList.add("sticky-header");

        const header = document.createElement('h2');
        header.textContent = method.name;
        hdr_container.appendChild(header);
        this.methodUIContainer.appendChild(hdr_container);

        if (!method.schema.params_schema || !schemaHasParams(method.schema.params_schema)) {
            const p = document.createElement('p');
            p.textContent = "No parameters required.";
            this.methodUIContainer.appendChild(p);
            return;
        }

        const form = document.createElement('div');
        form.className = 'schema-form';

        const rootSchema = method.schema.params_schema;
        const definitions = rootSchema.$defs || {};

        const inputElement = this.createInputForSchema(rootSchema, definitions, 'params');
        form.appendChild(inputElement);

        this.methodUIContainer.appendChild(form);

        const generate_btn_ctr = document.querySelector(`[data-rpc-id="${this.data_rpc_id}"] .btn-method-json-container`) as HTMLElement;
        if (generate_btn_ctr) {
            generate_btn_ctr.replaceChildren();

            const generateBtn = document.createElement('button');
            generateBtn.textContent = 'JSON';
            generateBtn.className = 'btn dialog-btn';

            generateBtn.onclick = () => {
                this.updateQueryInputFromForm();

                const query_input = document.querySelector(`.rpc-inspector-header-section[data-rpc-id="${this.data_rpc_id}"] .rpc_query`) as HTMLDivElement;
                if (query_input) {
                    query_input.classList.remove('hide');
                }
                this.container.classList.add('hide');

                const btn_edit_method = document.querySelector(`[data-rpc-id="${this.data_rpc_id}"] .btn-edit-method-input`) as HTMLButtonElement;
                if (btn_edit_method) btn_edit_method.classList.remove('hide');
                generate_btn_ctr.classList.add('hide');
            };

            generate_btn_ctr.appendChild(generateBtn);
        }
    }

    private createInputForSchema(schema: Schema, definitions: { [key: string]: Schema }, path: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'schema-node';
        container.dataset.path = path;

        if (schema.$ref) {
            const refName = schema.$ref.replace('#/$defs/', '');
            const refSchema = definitions[refName];
            if (refSchema) {
                // Render the referenced schema but keep the container context
                const refContainer = this.createInputForSchema(refSchema, definitions, path);
                // Add a label indicating the type if useful
                refContainer.dataset.ref = refName;
                return refContainer;
            } else {
                container.textContent = `Error: Reference ${schema.$ref} not found.`;
                return container;
            }
        }

        if (schema.oneOf) {
            return this.createOneOfInput(schema, definitions, path);
        }

        // Handle anyOf similarly to oneOf for now, or just pick the first one? 
        // The prompt specifically mentioned "oneOf".
        if (schema.anyOf) {
            // For simplicity, treat anyOf like oneOf for the UI, allowing user to pick one.
            // Or it might mean "at least one", which is harder. 
            // Given the context of RPC params, usually it's alternative types.
            return this.createOneOfInput({ ...schema, oneOf: schema.anyOf }, definitions, path);
        }

        if (schema.type) {
            const type = Array.isArray(schema.type) ? schema.type[0] : schema.type; // Handle type: ["string", "null"]

            switch (type) {
                case 'object':
                    return this.createObjectInput(schema, definitions, path);
                case 'array':
                    return this.createArrayInput(schema, definitions, path);
                case 'string':
                    return this.createStringInput(schema, path);
                case 'integer':
                case 'number':
                    return this.createNumberInput(schema, path);
                case 'boolean':
                    return this.createBooleanInput(schema, path);
                default:
                    container.textContent = `Unknown type: ${type}`;
                    return container;
            }
        }

        // Fallback for empty schema or unhandled cases
        if (schema.enum) {
            return this.createEnumInput(schema, path);
        }

        return container;
    }

    private createObjectInput(schema: Schema, definitions: { [key: string]: Schema }, path: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'schema-object';

        // if (schema.title) {
        //     const title = document.createElement('h4');
        //     title.textContent = schema.title;
        //     container.appendChild(title);
        // }

        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const propContainer = document.createElement('div');
                propContainer.className = 'schema-property';

                const label = document.createElement('label');
                label.textContent = key;
                if (schema.required && schema.required.includes(key)) {
                    label.classList.add('required');
                    label.textContent += ' *';
                }
                propContainer.appendChild(label);

                const input = this.createInputForSchema(propSchema, definitions, `${path}.${key}`);
                propContainer.appendChild(input);

                container.appendChild(propContainer);
            }
        }

        // Handle additionalProperties if needed (map-like objects)
        if (schema.additionalProperties) {
            // Complex to handle in a simple UI, skipping for now unless specifically requested.
        }

        return container;
    }

    private createArrayInput(schema: Schema, definitions: { [key: string]: Schema }, path: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'schema-array';

        const list = document.createElement('div');
        list.className = 'array-items';

        const addButton = document.createElement('button');
        addButton.textContent = 'Add Item';
        addButton.classList.add('btn', 'dialog-btn');
        addButton.type = 'button';
        addButton.onclick = () => {
            if (schema.items) {
                const index = list.children.length;
                const itemContainer = document.createElement('div');
                itemContainer.className = 'array-item';

                const itemInput = this.createInputForSchema(schema.items, definitions, `${path}[${index}]`);
                itemContainer.appendChild(itemInput);

                const removeButton = document.createElement('button');
                removeButton.textContent = 'Remove';
                removeButton.type = 'button';
                removeButton.classList.add('btn', 'dialog-btn');
                removeButton.onclick = () => list.removeChild(itemContainer);
                itemContainer.appendChild(removeButton);

                list.appendChild(itemContainer);
            }
        };

        container.appendChild(list);
        container.appendChild(addButton);

        return container;
    }

    private createStringInput(schema: Schema, path: string): HTMLElement {
        if (schema.enum) {
            return this.createEnumInput(schema, path);
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.path = path;
        if (schema.default !== undefined) input.value = schema.default;
        if (schema.description) input.title = schema.description;
        return input;
    }

    private createNumberInput(schema: Schema, path: string): HTMLElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.dataset.path = path;
        if (schema.default !== undefined) input.value = schema.default;
        if (schema.minimum !== undefined) input.min = schema.minimum.toString();
        if (schema.maximum !== undefined) input.max = schema.maximum.toString();
        return input;
    }

    private createBooleanInput(schema: Schema, path: string): HTMLElement {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.path = path;
        if (schema.default === true) input.checked = true;
        return input;
    }

    private createEnumInput(schema: Schema, path: string): HTMLElement {
        const select = document.createElement('select');
        select.dataset.path = path;

        (schema.enum || []).forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val;
            select.appendChild(option);
        });

        if (schema.default) select.value = schema.default;
        return select;
    }

    private createOneOfInput(schema: Schema, definitions: { [key: string]: Schema }, path: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'schema-oneof';

        const select = document.createElement('select');
        const options = schema.oneOf || [];

        options.forEach((opt, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            // Try to find a good label
            let label = `Option ${index + 1}`;
            if (opt.title) label = opt.title;
            else if (opt.type) label = Array.isArray(opt.type) ? opt.type.join('/') : opt.type;
            else if (opt.$ref) label = opt.$ref.replace('#/$defs/', '');

            option.textContent = label;
            select.appendChild(option);
        });

        const contentContainer = document.createElement('div');
        contentContainer.className = 'oneof-content';

        select.onchange = () => {
            contentContainer.innerHTML = '';
            const selectedIndex = parseInt(select.value);
            const selectedSchema = options[selectedIndex];
            contentContainer.appendChild(this.createInputForSchema(selectedSchema, definitions, path));
        };

        // Initialize with first option
        if (options.length > 0) {
            select.value = '0';
            select.dispatchEvent(new Event('change'));
        }

        container.appendChild(select);
        container.appendChild(contentContainer);
        return container;
    }

    public getFormData(): any {
        if (!this.currentMethod || !this.currentMethod.schema.params_schema) return {};

        const form = this.methodUIContainer.querySelector('.schema-form');
        if (!form) return {};

        // The form contains a single root input element (likely a schema-node)
        const root = form.firstElementChild as HTMLElement;
        return this.getValue(root);
    }

    private getValue(element: HTMLElement): any {
        if (!element) return null;

        if (element.tagName === 'INPUT' || element.tagName === 'SELECT') {
            const input = element as HTMLInputElement | HTMLSelectElement;
            if (input.type === 'checkbox') return (input as HTMLInputElement).checked;
            if (input.type === 'number') return input.value === '' ? null : Number(input.value);
            return input.value;
        }

        if (element.classList.contains('schema-node')) {
            // It's a wrapper. Check children.
            // If it has 'data-ref', it's a ref wrapper.
            // If it has 'schema-oneof', etc.
            // The structure is usually: schema-node -> (input | schema-object | schema-array | schema-oneof)
            const child = element.firstElementChild as HTMLElement;
            return this.getValue(child);
        }

        if (element.classList.contains('schema-object')) {
            const result: any = {};
            const props = element.querySelectorAll(':scope > .schema-property');
            props.forEach(prop => {
                const label = prop.querySelector('label');
                const key = label?.textContent?.replace(' *', '') || '';
                // The input container is the last child (after the label)
                const inputContainer = prop.lastElementChild as HTMLElement;
                const val = this.getValue(inputContainer);
                if (val !== undefined && val !== null) {
                    result[key] = val;
                }
            });
            return result;
        }

        if (element.classList.contains('schema-array')) {
            const list = element.querySelector('.array-items');
            if (!list) return [];
            const items = [];
            for (const child of Array.from(list.children)) {
                // child is .array-item
                // It contains the input container and a remove button.
                // The input container is the first child.
                const inputContainer = child.firstElementChild as HTMLElement;
                items.push(this.getValue(inputContainer));
            }
            return items;
        }

        if (element.classList.contains('schema-oneof')) {
            const content = element.querySelector('.oneof-content');
            if (content && content.firstElementChild) {
                return this.getValue(content.firstElementChild as HTMLElement);
            }
            return null;
        }

        return null;
    }
}
