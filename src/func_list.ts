
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
export class DocObject {
    syscall_id: number;
    gas_cost: number;
    signature: string = "";
    signature_tagged: string = "";
    description: string = "";
    example: string = "";

    constructor(syscall_id: number, gas_cost: number, signature: string, signature_tagged: string) {
        this.syscall_id = syscall_id;
        this.gas_cost = gas_cost;
        this.signature = signature;
        this.signature_tagged = signature_tagged;
    }
}

type StdLibDocMap = Map<string, Map<number, DocObject>>;

export class StdLibDocObject {
    methods_by_category_syscall_map: StdLibDocMap;
    const_functions_by_category_syscall_map: StdLibDocMap;
    loaded: boolean = false;

    // TODO: create this from doc_out.json layout.
    static std_function_order = new Map<string, string>([
        ["Global Utility", ""],
        ["T0[]", "Array"],
        ["optional<T0>", "Optional (T or null)"],
        ["map<T0, T1>", "Map"],
        ["string", "String"],
        ["range<T0>", "Range"],
        ["u8", ""],
        ["u16", ""],
        ["u32", ""],
        ["u64", ""],
        ["u128", ""],
        ["u256", ""],
        ["u8[]", ""],
        ["Transaction", ""],
        ["Block", ""],
        ["Storage", ""],
        ["ReadOnlyStorage", ""],
        ["MemoryStorage", ""],
        ["Address", ""],
        ["Hash", ""],
        ["Random", ""],
        ["Signature", ""],
        ["Asset", ""],
        ["Contract", ""],
        ["T", ""],
        ["T0[][]", ""],
        ["bytes", "Bytes"],
        ["Scalar", ""],
        ["Transcript", ""],
        ["ArbitraryRangeProof", ""],
        ["BalanceProof", ""],
        ["CiphertextValidityProof", ""],
        ["CommitmentEqualityProof", ""],
        ["RangeProof", ""],
        ["OwnershipProof", ""],
        ["RistrettoPoint", ""],
        ["Ciphertext", ""],
        ["MaxSupplyMode", ""],
        ["ScheduledExecution", ""],
        ["BTreeCursor", ""],
        ["BTreeStore", ""],
    ]);

    static const_function_order = new Map<string, string>([
        ["T0[]", "Array"],
        ["bytes", "Bytes"],
        ["u8[]", "u8[]"],
        ["u16[]", "u16[]"],
        ["u32[]", "u32[]"],
        ["u64[]", "u64[]"],
        ["u128[]", "u128[]"],
        ["u256[]", "u256[]"],
    ]);

    constructor(silex_funcs: any[], silex_const_funcs: any[]) {
        this.methods_by_category_syscall_map = new Map();
        this.const_functions_by_category_syscall_map = new Map();

        silex_funcs.forEach((f) => {
            let type_or_category_name = f.on_type() ? f.on_type() : `Global Utility`;
            let ordered_cat_name = StdLibDocObject.std_function_order.get(type_or_category_name) || type_or_category_name;
            ordered_cat_name = ordered_cat_name === "" ? type_or_category_name : ordered_cat_name;

            // add to order if not already there
            if (!StdLibDocObject.std_function_order.has(type_or_category_name)) {
                StdLibDocObject.std_function_order.set(type_or_category_name, type_or_category_name);
            }

            let sycall_map_for_category = this.methods_by_category_syscall_map.get(ordered_cat_name);
            if (!sycall_map_for_category) {
                this.methods_by_category_syscall_map.set(ordered_cat_name, new Map<number, DocObject>());
            }

            const name = escapeHtml(f.name());
            const params = f.params().map(escapeHtml).join(", ");
            const retType = f.return_type() ? escapeHtml(f.return_type()) : "";
            const onType = ordered_cat_name ? escapeHtml(ordered_cat_name) : "";

            let signature = "";
            let signature_tagged = "";

            if (f.return_type()) {
                signature = `${f.name()}(${f.params().join(", ")}) ⟶ ${f.return_type() || ""}`;
                signature_tagged = `<function>${name}</function><parameter>(${params})</parameter> <arrow>⟶</arrow> <ret_type>${retType}</ret_type>`;
            } else {
                signature = `${f.name()}(${f.params().join(", ")})`;
                signature_tagged = `<function>${name}</function><parameter>(${params})</parameter>`;
            }

            if (!f.is_on_instance() && ordered_cat_name != `Global Utility`) {
                signature = `${ordered_cat_name || ""}::` + signature;
                signature_tagged = `<ret_type>${onType}</ret_type>::` + signature_tagged;
            }

            let doc_func = new DocObject(f.syscall_id(), f.gas_cost_formatted(), signature, signature_tagged);
            this.methods_by_category_syscall_map.get(ordered_cat_name)?.set(f.syscall_id(), doc_func);
        });

        // constant functions execute at compile time, so they
        // dont have a gas cost or syscall id. 
        let const_syscall_gas_mark = -100;

        silex_const_funcs.forEach((f) => {
            let ordered_cat_name = StdLibDocObject.const_function_order.get(f.for_type()) || f.for_type();
            if (!StdLibDocObject.const_function_order.has(f.for_type())) {
                StdLibDocObject.const_function_order.set(f.for_type(), f.for_type());
            }

            let sycall_map_for_category = this.const_functions_by_category_syscall_map.get(ordered_cat_name);
            if (!sycall_map_for_category) {
                this.const_functions_by_category_syscall_map.set(ordered_cat_name, new Map<number, DocObject>());
            }

            let signature = `(const) ${f.for_type()}::${f.name()}(${f.params().join(", ")}) ⟶ ${f.for_type()}`;
            let signature_tagged = `(const) <ret_type>${f.for_type()}</ret_type>::<function>${f.name()}</function>(${f.params().join(", ")}) <arrow>⟶</arrow> <ret_type>${f.for_type()}</ret_type>`;

            const_syscall_gas_mark--;

            let doc_func = new DocObject(const_syscall_gas_mark, parseInt((const_syscall_gas_mark / 100000000).toFixed(0)), signature, signature_tagged);
            this.const_functions_by_category_syscall_map.get(ordered_cat_name)?.set(const_syscall_gas_mark, doc_func);
        });
    }

    cat_type_by_doc_order() {

        //console.log(this.documentation);
        let output_ordered = ``;

        let is_first = true;

        // std lib functions
        StdLibDocObject.std_function_order.forEach((name, key) => {
            const docobjects = this.methods_by_category_syscall_map.get(key);
            if (docobjects) {
                let category_name = name === "" ? key : name;
                if (is_first) {
                    output_ordered += `\n["${category_name}", [\n`;
                    is_first = false;
                } else {
                    output_ordered += `]], \n["${category_name}", [\n`;
                }

                docobjects.forEach((doc, syscall_id) => {
                    output_ordered += `{"syscall_id": ${syscall_id}, "signature": "${doc.signature}", "gas_cost": ${(doc.gas_cost * 100000000).toFixed(0)}},\n`;
                });
            }
        });

        // const functions
        StdLibDocObject.const_function_order.forEach((name, key) => {
            const docobjects = this.const_functions_by_category_syscall_map.get(key);
            if (docobjects) {
                let category_name = name === "" ? key : name;
                if (is_first) {
                    output_ordered += `\n["${category_name}", [\n`;
                    is_first = false;
                } else {
                    output_ordered += `]], \n["${category_name}", [\n`;
                }

                docobjects.forEach((doc, syscall_id) => {
                    output_ordered += `{"syscall_id": ${syscall_id}, "signature": "${doc.signature}", "gas_cost": ${(doc.gas_cost).toFixed(0)}},\n`;
                });
            }
        });

        const output = output_ordered !== "" ? `[${output_ordered}]]]` : `[]`;

        // get rid of the last comma
        const regex = /,\n(\]\],)/g;
        const replacement = '$1';
        console.log(output.replaceAll(regex, replacement));
    }
}

export class FuncList {
    main_container: HTMLElement;
    fl_container: HTMLElement;
    search_func_list: HTMLInputElement;

    search_results_default_show: boolean = false;

    funcs: any[] = [];
    const_funcs: any[] = [];
    private documentation_map!: StdLibDocObject;
    private search_results_std_funcs!: StdLibDocMap;
    private search_results_const_funcs!: StdLibDocMap;

    static live_docs: Map<string, DocObject[]> = new Map();

    constructor(silex: any) {

        this.reload(silex, false);
        this.main_container = document.getElementById('function_list') as HTMLElement;
        this.fl_container = document.getElementById('function_list_items') as HTMLElement;

        this.search_func_list = document.getElementById('search_func_list') as HTMLInputElement;
        this.search_func_list.addEventListener("input", (e) => this.handle_search_input(e));
        this.search_func_list.value = localStorage.getItem(`list-functions-search`) || ``;
    }

    // Reload functions from silex (e.g., when contract version changes)
    reload(silex: any, reload: boolean = true) {
        this.funcs = silex.get_env_functions();
        this.const_funcs = silex.get_constants_functions();
        this.documentation_map = new StdLibDocObject(this.funcs, this.const_funcs);
        this.search_results_std_funcs = this.documentation_map.methods_by_category_syscall_map;
        this.search_results_const_funcs = this.documentation_map.const_functions_by_category_syscall_map;

        // Reload documentation
        this.load_documentation();
        if (reload) {
            this.render_functions_ui();
        }
    }

    /* 
    fetch documentation from github
    if fetch fails, fetch from localstorage
    */
    async load_documentation() {
        try {
            await fetch("https://raw.githubusercontent.com/xelis-project/xelis-docs/refs/heads/master/resources/standard-library/doc_out.json")
                .then(response => response.text())
                .then(data => {
                    const docs = JSON.parse(data);
                    docs.forEach((doc_obj: { name: string; functions: DocObject[]; }) => {
                        FuncList.live_docs.set(doc_obj.name, doc_obj.functions);
                    });

                    localStorage.setItem(`list-functions-docs`, JSON.stringify(FuncList.live_docs));
                });
        } catch (e) {

            // if fetch fails, fetch from localstorage
            if (FuncList.live_docs.size === 0) {
                const docs = localStorage.getItem(`list-functions-docs`);
                if (docs) {
                    FuncList.live_docs = JSON.parse(docs);
                }
            };
        }

        // add the descriptions to the functions
        [this.documentation_map.methods_by_category_syscall_map, this.documentation_map.const_functions_by_category_syscall_map].forEach((doc_map) => {
            doc_map.forEach((docs, category) => {
                docs.forEach((doc, syscall_id) => {
                    const live_doc = FuncList.get_live_documentation_for(category, doc.signature);
                    if (live_doc) {
                        doc.description = live_doc.description || `Add documentation.`;
                    } else {
                        doc.description = `*Add documentation. `;
                    }
                });
            });
        });

        this.search_func_list.dispatchEvent(new Event("input"));
        this.documentation_map.cat_type_by_doc_order();
    }

    static get_live_documentation_for(category: string, signature: string) {
        let ordered_cat_name = StdLibDocObject.std_function_order.get(category) || category;
        ordered_cat_name = ordered_cat_name === "" ? category : ordered_cat_name;
        return FuncList.live_docs.size > 0 ? FuncList.live_docs.get(ordered_cat_name)?.find((doc) => doc.signature === signature) : undefined;
    }

    handle_search_input(e: Event) {
        const search_value = (e.target as HTMLInputElement).value;
        localStorage.setItem(`list-functions-search`, search_value);

        if (search_value === "") {
            this.search_results_std_funcs = this.documentation_map.methods_by_category_syscall_map;
            this.search_results_const_funcs = this.documentation_map.const_functions_by_category_syscall_map;
            this.render_functions_ui();
            return;
        }

        this.search_results_std_funcs = new Map();
        this.search_results_const_funcs = new Map();

        [[this.documentation_map.methods_by_category_syscall_map, this.search_results_std_funcs]
            , [this.documentation_map.const_functions_by_category_syscall_map, this.search_results_const_funcs]]
            .forEach(([map, search_results]) => {
                map.forEach((docobjects, key) => {
                    if (key.toLocaleLowerCase().includes(search_value.toLocaleLowerCase())) {
                        search_results.set(key, docobjects);
                        return;
                    }

                    let found_docs: Map<number, DocObject> = new Map();

                    docobjects.forEach((doc, syscall_id) => {
                        if (doc.signature.toLocaleLowerCase().includes(search_value.toLocaleLowerCase())
                            || doc.description.toLocaleLowerCase().includes(search_value.toLocaleLowerCase())
                            || doc.syscall_id.toString().toLocaleLowerCase() === search_value.toLocaleLowerCase()
                        ) {
                            found_docs.set(syscall_id, doc);
                            return;
                        }
                    });

                    if (found_docs.size > 0) {
                        search_results.set(key, found_docs);
                    }
                });
            });
        this.render_functions_ui();

    }

    render_functions_ui() {
        const _thisFuncList = this;
        this.fl_container.innerHTML = "";
        let method_container: HTMLElement;

        const separator = document.createElement(`div`);
        separator.classList.add(`panel-title`, `title`, `const-section-title`);
        separator.innerText = `Standard functions`;

        const note = document.createElement(`div`);
        note.classList.add(`note`);
        note.innerText = `(Built in functions)`;

        separator.append(note);

        if (this.search_results_std_funcs.size > 0) {
            this.fl_container.append(separator);
        }

        function make_doc_table(syscall_id: number, gas_cost: number, description: string) {
            const doc_container = document.createElement(`div`);
            doc_container.classList.add(`func-doc-container`, `hide`);

            const doc_sc_gas = document.createElement(`div`);
            doc_container.append(doc_sc_gas);

            doc_sc_gas.innerHTML = `<div><div class="label">Syscall</div><div class="value">${syscall_id}</div></div><div><div class="label">Gas</div> <div class="value">${(gas_cost * 100000000).toFixed(0)} lex</div></div>`;

            const doc_desc = document.createElement(`div`);
            doc_container.append(doc_desc);

            doc_desc.innerHTML = `<div class="description">${description}</div>`;

            return doc_container;
        }

        function render_found_set(results: Map<string, Map<number, DocObject>>, order: Map<string, string>, marker: string) {
            order.forEach((value, key) => {
                let ordered_cat_name = order.get(key) || key;
                ordered_cat_name = ordered_cat_name === "" ? key : ordered_cat_name;

                if (!results.has(ordered_cat_name)) {
                    return;
                }

                const type_container = document.createElement(`div`);
                type_container.classList.add(`section-header`, `info-block`, `accordion`);
                type_container.setAttribute("data-lib-category", ordered_cat_name);
                const title = document.createElement(`div`);

                title.innerText = `${ordered_cat_name}`;
                type_container.append(title);

                _thisFuncList.fl_container.append(type_container);

                // make the method container for this type
                method_container = document.createElement(`div`);
                method_container.classList.add(`method-container`, (_thisFuncList.search_results_default_show ? `active` : `inactive`), marker);
                method_container.setAttribute("data-lib-category", ordered_cat_name);
                _thisFuncList.fl_container.append(method_container);

                type_container.addEventListener("click", function () {
                    this.classList.toggle("active");
                    const mc = this.nextElementSibling as HTMLElement;

                    if (mc.classList.contains("active")) {
                        mc.classList.remove("active");
                        mc.classList.add("inactive");
                    } else if (mc.classList.contains("inactive")) {
                        mc.classList.add("active");
                        mc.classList.remove("inactive");
                    }
                });

                results.get(ordered_cat_name)?.forEach((doc) => {
                    const el_func = document.createElement(`div`);
                    el_func.classList.add(`func-item`);
                    //el_func.classList.add(`with-tooltip`);
                    el_func.setAttribute("data-tooltip", `Syscall id: ${doc.syscall_id}, gas cost: ${doc.gas_cost}`);
                    el_func.setAttribute("data-syscall-id", doc.syscall_id.toString());

                    const el_func_sig = document.createElement(`div`);
                    el_func_sig.classList.add(`func-item-sig`);

                    el_func_sig.innerHTML = doc.signature_tagged;

                    const doc_container = make_doc_table(doc.syscall_id, doc.gas_cost, doc.description);

                    el_func.append(el_func_sig);
                    el_func.append(doc_container);
                    method_container.append(el_func);

                    el_func.addEventListener("click", function () {
                        // hide/show the container
                        if (doc_container.classList.contains(`hide`)) {
                            doc_container.classList.remove(`hide`);
                            doc_container.classList.add(`show`);
                        } else {
                            doc_container.classList.remove(`show`);
                            doc_container.classList.add(`hide`);
                        }
                    });

                });
            });
        }

        render_found_set(this.search_results_std_funcs, StdLibDocObject.std_function_order, "std");

        const cf_separator = document.createElement(`div`);
        cf_separator.classList.add(`panel-title`, `title`, `const-section-title`);
        cf_separator.innerText = `Const functions`;

        const cf_note = document.createElement(`div`);
        cf_note.classList.add(`note`);
        cf_note.innerText = `(executed at compile time only)`;

        cf_separator.append(cf_note);

        if (this.search_results_const_funcs.size > 0) {
            this.fl_container.append(cf_separator);
        }

        render_found_set(this.search_results_const_funcs, StdLibDocObject.const_function_order, "const");
    }
}
