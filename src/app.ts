import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-rust';
import 'ace-builds/src-noconflict/theme-tomorrow_night_bright';

import { Silex } from '../public/xelis_playground';
import { CustomSelect } from './custom_select';
import { SplitLayout } from "./split_layout";
import { TextDotLoading } from './text_dot_loading';
import { ModalExport } from "./model_export";
import { FuncList } from './func_list';
import { Modal } from './modal';
import { XVMParamParser } from './parameter_builder/xvm_param_parser';
import { ParameterBuilder } from './parameter_builder/parameter_builder';

export class App {
    silex: any;

    modal: Modal;
    func_list: FuncList;
    modal_export: ModalExport;
    split_layout: SplitLayout;
    custom_select: CustomSelect;

    editor: ace.Editor;
    output: HTMLElement;
    //program_entries_select: HTMLSelectElement;
    //program_entry_params: HTMLElement;
    btn_run: HTMLElement;
    btn_compile: HTMLElement;
    input_max_gas: HTMLInputElement;
    examples_select: HTMLSelectElement;
    btn_output_clear: HTMLElement;
    btn_output_copy: HTMLElement;
    btn_output_panel_toggle: HTMLElement;
    editor_lines: HTMLElement;
    btn_export: HTMLElement;
    tabsize_select: HTMLSelectElement;

    btn_edit_params: HTMLElement;
    pb_ui: HTMLElement;
    pb_main_container: HTMLElement;
    parameter_display: HTMLElement;
    pba_readonly: HTMLElement;
    entry_call_container: HTMLElement;
    signature_container: HTMLElement;
    btn_entry_call: HTMLElement;
    btn_signature: HTMLElement;
    btn_copy: HTMLElement;
    entry_menu: HTMLElement;
    arg_ro_message: HTMLElement;

    program_code: string;
    program_entry_index: number;
    xvm_param_parser: XVMParamParser;
    output_panel_expanded: boolean = false;

    constructor(silex: Silex) {
        this.silex = silex;
        this.program_code = "";
        this.program_entry_index = 0;
        this.xvm_param_parser = new XVMParamParser();

        this.output = document.getElementById('output') as HTMLElement;
        //this.program_entries_select = document.getElementById('program_entries_select') as HTMLSelectElement;
        //this.program_entry_params = document.getElementById('program_entry_params') as HTMLElement;
        this.btn_run = document.getElementById('btn_run') as HTMLElement;
        this.btn_compile = document.getElementById('btn_compile') as HTMLElement;
        this.input_max_gas = document.getElementById('input_max_gas') as HTMLInputElement;
        this.examples_select = document.getElementById('examples_select') as HTMLSelectElement;
        this.btn_output_clear = document.getElementById('btn_output_clear') as HTMLElement;
        this.btn_output_copy = document.getElementById('btn_output_copy') as HTMLElement;
        this.btn_output_panel_toggle = document.getElementById('btn_output_panel_toggle') as HTMLElement;
        this.editor_lines = document.getElementById('editor_lines') as HTMLElement;
        this.btn_export = document.getElementById('btn_export') as HTMLElement;
        this.tabsize_select = document.getElementById('tabsize_select') as HTMLSelectElement;

        this.btn_edit_params = document.getElementById('edit-entry-params-btn') as HTMLButtonElement;
        this.btn_entry_call = document.querySelector(`#entry-call-btn`) as HTMLButtonElement;
        this.btn_signature = document.querySelector(`#signature-btn`) as HTMLButtonElement;
        this.btn_copy = document.querySelector(`#copy-ec-btn`) as HTMLButtonElement;

        this.pb_ui = document.getElementById('modal_parameter_builder') as HTMLElement;
        this.pb_main_container = document.querySelector('div.parameter-builder-container') as HTMLElement;
        this.parameter_display = document.getElementById('parameter-display') as HTMLElement;
        this.pba_readonly = document.getElementById('pba-readonly') as HTMLElement;
        this.entry_call_container = document.querySelector(`#entry-call-container`) as HTMLElement;
        this.signature_container = document.querySelector(`#signature-container`) as HTMLElement;
        this.entry_menu = document.getElementById('entry-menu') as HTMLElement;
        this.arg_ro_message = document.querySelector(`#pba-readonly > div.message`) as HTMLElement;

        this.btn_export.addEventListener('click', () => this.open_modal_export());
        this.btn_compile.addEventListener('click', () => this.compile_code());
        this.btn_copy.addEventListener('click', () => this.copy_text_to_clipboard(this.entry_call_container.textContent || ""));
        this.btn_run.addEventListener('click', async () => await this.run_program());
        this.btn_output_clear.addEventListener('click', () => this.clear_output());
        this.btn_output_copy.addEventListener('click', () => this.copy_text_to_clipboard(this.output.textContent || ""));
        this.btn_output_panel_toggle.addEventListener('click', () => this.output_panel_toggle(undefined));
        this.examples_select.addEventListener('change', async (e) => await this.handle_examples_change(e));
        this.tabsize_select.addEventListener('change', (e) => this.handle_tabsize_change(e));

        this.btn_entry_call.addEventListener('click', () => {
            this.signature_container.classList.add('hide');
            this.entry_call_container.classList.remove('hide');
            this.arg_ro_message.classList.add('hide');

            this.btn_signature.classList.remove('hide');
            this.btn_entry_call.classList.add('hide');
        });

        this.btn_signature.addEventListener('click', () => {
            this.signature_container.classList.remove('hide');
            this.entry_call_container.classList.add('hide');

            if (this.xvm_param_parser.parameter_builder_data[this.program_entry_index].parameters.length === 0) {
                this.arg_ro_message.classList.remove('hide');
            } else {
                this.arg_ro_message.classList.add('hide');
            }

            this.btn_signature.classList.add('hide');
            this.btn_entry_call.classList.remove('hide');
        });

        this.btn_edit_params.addEventListener('click', () => this.handle_edit_params());

        /* We update the readonly display whenever the parameter builder changes */
        document.addEventListener("pb-argument-did-change", () => {
            this.update_ro_argument_display();
        });

        this.modal = new Modal();

        this.func_list = new FuncList(this);
        this.split_layout = new SplitLayout(this);
        this.func_list.load_funcs(this.silex);
        this.custom_select = new CustomSelect();
        this.modal_export = new ModalExport(this);

        const editor_element = document.getElementById('input_editor') as HTMLPreElement;
        this.editor = ace.edit(editor_element);
        this.editor.session.setMode("ace/mode/rust");
        this.editor.setTheme("ace/theme/tomorrow_night_bright");
        this.editor.setOptions({
            enableAutoIndent: true,
            wrapBehavioursEnabled: true // auto surround
        });

        this.editor.setHighlightActiveLine(false);
        this.editor.renderer.setPadding(8);
        this.editor.renderer.setScrollMargin(10, 10)

        this.load_save();
        this.custom_select.build_selects();
    }

    load_save() {
        let code = localStorage.getItem('code');
        if (!code) {
            code = `entry main() {\r\tprintln("Hello, World!");\r\treturn 0;\r}`;
        }

        this.set_editor_code(code);

        const tabsize = localStorage.getItem('tabsize') || '4';
        this.set_tabsize(tabsize);

    }

    set_tabsize(tabsize: string) {
        this.tabsize_select.value = tabsize;
        this.editor.setOption("tabSize", parseInt(tabsize));
    }

    set_editor_code(code: string) {
        this.editor.setValue(code, -1); // -1 places the cursor at the top -- undefined or 0 select all text
        this.program_changed();
    }

    program_changed() {
        if (this.program_code && this.program_code !== this.editor.getValue()) {
            this.btn_run.setAttribute("disabled", "");
            this.btn_export.setAttribute("disabled", "");
            this.output.innerHTML = "";

            this.clear_program();
            this.program_code = "";
            this.program_entry_index = 0;
        }
    }

    save_code() {
        localStorage.setItem('code', this.editor.getValue());
    }

    clear_program() {
        this.xvm_param_parser = new XVMParamParser();
        this.entry_call_container.replaceChildren();
        this.entry_menu.replaceChildren();

        // UI
        const e_name_ro = document.querySelector(`#hud-entry-name`) as HTMLElement;
        e_name_ro.textContent = `- none -`;

        // entry call window
        this.btn_entry_call.click();

        this.btn_run.setAttribute('disabled', '');
        this.btn_export.setAttribute("disabled", "");
        this.btn_edit_params.setAttribute('disabled', '');
        this.btn_entry_call.setAttribute('disabled', '');
        this.btn_signature.setAttribute('disabled', '');
        this.btn_copy.setAttribute('disabled', '');

    }

    add_entry(entry: any, index: number) {
        const link = document.createElement(`a`);
        link.classList.add(`entry-link`);
        link.setAttribute(`data-entry-index`, `${index}`);
        link.textContent = entry.name();
        this.entry_menu.appendChild(link);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            /* defaults */
            this.arg_ro_message.classList.add('hide');
            /* end defaults */

            this.program_entry_index = index;

            const params = this.xvm_param_parser.parameter_builder_data[this.program_entry_index].parameters;

            if (params.length > 0) {
                this.btn_edit_params.removeAttribute('disabled');
            } else {
                this.btn_edit_params.setAttribute('disabled', '');
            }

            const entry_name = this.xvm_param_parser.parameter_builder_data[this.program_entry_index].name;
            const e_name_ro = document.querySelector(`#hud-entry-name`) as HTMLElement;
            e_name_ro.textContent = `${entry_name}`;

            this.signature_container.replaceChildren();

            params.forEach((param, index) => {
                const p_elem = document.createElement("parameter");
                const label = document.createElement("label");
                const sig = document.createElement("signature");

                label.textContent = `${param.name}: `;
                sig.textContent = `${param.signature}`;
                p_elem.appendChild(label);
                p_elem.appendChild(sig);
                this.signature_container.appendChild(p_elem);
            });

            this.entry_menu.style.display = 'none';
            this.entry_menu.classList.remove('dropdown-content');

            setTimeout(() => {
                this.entry_menu.style.display = '';
                this.entry_menu.classList.add('dropdown-content');
            }, 500);

            this.update_ro_argument_display();
        });
    }

    update_ro_argument_display() {
        if (this.entry_call_container !== null) {
            this.entry_call_container.replaceChildren();
            const e_name = this.xvm_param_parser.parameter_builder_data[this.program_entry_index].name;
            const func_name = document.createElement(`entry-name`);
            func_name.classList.add(`code`);
            func_name.textContent = `${e_name}(`;
            this.entry_call_container.appendChild(func_name);
            const pba_container = document.querySelector(`#pb_entry_container_${this.program_entry_index} > div.pb-arguments-container`) as HTMLElement;
            if (pba_container.hasChildNodes()) {
                for (const node of pba_container.childNodes) {
                    this.entry_call_container.appendChild(node.cloneNode(true));
                }
            }
            const close_func_name = document.createElement(`entry-name`);
            close_func_name.classList.add(`code`);
            close_func_name.textContent = `)`;
            this.entry_call_container.appendChild(close_func_name);
        }
    }

    /*
    add_entry_params(entry: any, index: number) {
        const container = document.createElement(`div`);
        container.id = `entry_params_${index}`;
        container.classList.add(`spec-column`, `hidden`);
        const params = entry.parameters();

        params.forEach((param: any, param_index: number) => {
            const item = document.createElement(`div`);
            item.classList.add(`spec-param`);

            const title = document.createElement(`div`);
            title.textContent = `${param.name()} (${param.type_name()})`;

            const input = document.createElement(`input`);
            input.type = "text";
            input.autocomplete = `off`;
            input.autocapitalize = `off`;
            input.placeholder = `required`;
            input.setAttribute(`data-type`, param.type_name());
            input.classList.add('input');
            input.name = `entry_params_${index}_input`;

            item.appendChild(title);
            item.appendChild(input);
            container.appendChild(item);
        });

        if (params.length === 0) {
            container.innerHTML = `None`;
        }

        this.program_entry_params.appendChild(container);
    }
        */

    output_error(text: string, append: boolean = false) {
        return `<span class="out-err">${text}</span>`;
    }

    output_success(text: string, append: boolean = false) {
        return `<span class="out-success">${text}</span>`;
    }

    compile_code() {
        try {
            this.save_code();
            this.clear_program();
            this.output.innerHTML = "Program saved locally.\n";
            const code = this.editor.getValue();
            localStorage.setItem('code', code);

            this.output.textContent += "------- Compiling -------\n";
            const program = this.silex.compile(code);

            const entries = program.entries();
            entries.forEach((entry: any, index: number) => {
                this.xvm_param_parser.make_schema_from_entry(entry);
                this.add_entry(entry, index);

                let pb_entry_container = document.getElementById(`pb_entry_container_${index}`);
                let pb_input_container: HTMLElement;
                let arg_container: HTMLElement;

                if (pb_entry_container !== null) {
                    pb_input_container = pb_entry_container.querySelector(`div.pb-input-container`) as HTMLElement;
                    arg_container = pb_entry_container.querySelector(`div.pb-arguments-container`) as HTMLElement;
                } else {
                    pb_entry_container = document.createElement(`div`);
                    pb_entry_container.id = `pb_entry_container_${index}`;
                    pb_entry_container.classList.add(`pb_entry_container`);

                    pb_input_container = document.createElement(`div`);
                    pb_input_container.classList.add(`pb-input-container`);

                    arg_container = document.createElement(`div`);
                    arg_container.classList.add(`pb-arguments-container`);

                    pb_entry_container.appendChild(pb_input_container);
                    pb_entry_container.appendChild(arg_container);
                    this.pb_main_container.appendChild(pb_entry_container);
                }

                pb_entry_container.setAttribute('data-pbe-index', `${index}`);

                const parsed_entry = this.xvm_param_parser.parameter_builder_data[index];
                console.log(parsed_entry);
                ParameterBuilder.build_from_schema(parsed_entry.parameters, {
                    arg_container: arg_container,
                    pb_container: pb_input_container
                });
            });

            if (entries.length === 0) {
                this.btn_run.setAttribute('disabled', '');
            } else {
                this.btn_run.removeAttribute('disabled');
                const first_menu_link = document.querySelector(`#entry-menu a`) as HTMLLinkElement;
                first_menu_link.click();
            }

            this.program_code = code;
            this.output.innerHTML += this.output_success("Compiled successfully!\n");

            this.btn_export.removeAttribute('disabled');
            this.btn_entry_call.removeAttribute('disabled');
            this.btn_entry_call.classList.add('selected');
            this.btn_signature.removeAttribute('disabled');
            this.btn_copy.removeAttribute('disabled');
        } catch (e) {
            this.output.innerHTML += this.output_error("Error: " + e + "\n");
        }
    }

    get_program_params() {
        const params = [] as string[];
        const pbe_params_elems = document.querySelectorAll(`#pb_entry_container_${this.program_entry_index} > div.pb-arguments-container > pre`);
        pbe_params_elems.forEach((pbe, index) => {
            // remove the quotes
            const copy_pbe = pbe.cloneNode(true) as HTMLElement;
            const type_name = copy_pbe.firstChild?.nodeName.toLowerCase();

            let content: string | null | undefined;

            ['quote'].forEach(c => {
                const brace_children = copy_pbe.querySelectorAll(c);
                for (const b of brace_children) {
                    b.remove();
                }
            });

            // TODO: Verify that the opaque type format will be specialized.
            switch (type_name) {
                case 'opaque':
                    // address tag, hash tag, etc.
                    const opaque_type = copy_pbe.firstChild?.firstChild?.firstChild;
                    console.log(opaque_type);
                    //const ot_name = opaque_type?.nodeName.toLowerCase();
                    //content =`{type: "${ot_name}", value: ${opaque_type?.textContent}}`
                    content = opaque_type?.textContent
                    break;

                default:
                    content = copy_pbe.textContent;
                    break;
            }

            params.push(`${content}`);
        });

        console.log("GET_PARAMS OUTPUT");
        console.log(params);

        return params;
    }

    btn_run_set_running() {
        this.btn_run.textContent = "Running";
        this.btn_run.setAttribute(`disabled`, "");
    }

    btn_run_set_run() {
        this.btn_run.textContent = "Run";
        this.btn_run.removeAttribute(`disabled`);
    }

    async run_program() {
        let max_gas = null as bigint | null; // infinite
        this.output.innerHTML = "";

        if (this.input_max_gas.value) {
            const max_gas_int = parseInt(this.input_max_gas.value);
            if (max_gas_int < 0) {
                this.output.innerHTML = this.output_error("Error: Max gas cannot be negative.\n");
                return;
            }

            max_gas = BigInt(max_gas_int);
        }

        this.btn_run_set_running();
        this.btn_export.setAttribute("disabled", "");

        const output_dot_loading = new TextDotLoading(this.output, 3);

        try {
            if (this.silex.has_program_running()) {
                this.output.innerHTML = this.output_error("A program is already running!\n");
                return;
            }

            const program = this.silex.compile(this.program_code);
            const entry = program.entries()[this.program_entry_index];
            this.output.textContent = `-------- Running (${entry.name()} at index ${entry.id()}) --------\n`;
            output_dot_loading.start();

            const params = this.get_program_params();
            this.btn_compile.setAttribute("disabled", "");
            let result = await this.silex.execute_program(program, entry.id(), max_gas, params);
            output_dot_loading.stop();

            this.output.textContent = "";
            let logs = result.logs();
            if (logs.length > 0) {
                this.output.textContent += logs.join("\n");
                this.output.textContent += "\n";
            }

            this.output.textContent += `-------- Result --------\n`;
            this.output.textContent += `Exit code: ${result.value()}\n`;
            this.output.textContent += `Executed in: ${result.elapsed_time()}\n`;
            this.output.textContent += `Gas usage: ${result.used_gas()} (${result.used_gas_formatted()} XEL)\n`;
            this.output.textContent += `Memory usage: ${result.used_memory()} (${result.used_memory_formatted()})\n`;

            const storage = result.storage();
            console.log(storage);
            if (storage.length > 0) {
                this.output.textContent += `-------- Storage --------\n`;
                storage.forEach((item: any) => {
                    this.output.textContent += `${item.key()}: ${item.value()}\n`;
                });
            }
        } catch (e) {
            output_dot_loading.stop();
            this.output.innerHTML += this.output_error("Error: " + e + "\n");
        }

        this.btn_run_set_run();
        this.btn_export.removeAttribute("disabled");
        this.btn_compile.removeAttribute("disabled");
    }

    clear_output() {
        this.output.textContent = "";
    }

    async handle_examples_change(e: Event) {
        const url = (e.target as HTMLSelectElement).value;

        const res = await fetch(url);
        let code = await res.text();
        code = this.replace_spaces_indentation(code);
        this.set_editor_code(code);
    }

    save_tabsize() {
        localStorage.setItem("tabsize", this.tabsize_select.value);
    }

    handle_tabsize_change(e: Event) {
        const target = e.target as HTMLSelectElement;
        this.set_tabsize(target.value);
        this.save_tabsize();
    }

    handle_input_change(e: Event) {
        this.program_changed();
    }

    open_modal_export() {
        this.modal.open(this.modal_export.element);
    }

    get_program() {
        return this.silex.compile(this.program_code);
    }

    replace_spaces_indentation(data: string) {
        return data.replace(/^( +)/gm, (match) => {
            const tab_count = Math.floor(match.length / 4);
            return `\t`.repeat(tab_count);
        });
    }

    /** Opens the parameter builder modal.
     * TODO: Best to move this into the program window, and get rid of the modal.
     * */
    handle_edit_params() {
        this.pb_ui.classList.remove('hidden');

        for (const pbe of this.pb_main_container.children) {
            if (parseInt(pbe.getAttribute("data-pbe-index") || "") === this.program_entry_index) {
                const entry_stat = document.querySelector(`.entry-stat > span`);
                if (entry_stat !== null) {
                    entry_stat.textContent = `${this.xvm_param_parser.parameter_builder_data[this.program_entry_index].name}`;
                }

                const param_stat = document.querySelector(`.param-stat > span`);
                if (param_stat !== null) {
                    param_stat.textContent = `${this.xvm_param_parser.parameter_builder_data[this.program_entry_index].parameters.length}`;
                }

                pbe.classList.remove('hide');
            } else {
                pbe.classList.add('hide');
            }
        }
    }

    output_panel_toggle(should_shrink: boolean | undefined) {

        const btn_output_panel_expand = document.querySelector(`#btn_output_panel_expand`) as HTMLButtonElement;
        const btn_output_panel_shrink = document.querySelector(`#btn_output_panel_shrink`) as HTMLButtonElement;
        const gas_limit_display = document.querySelector(`#gas_limit_display`) as HTMLElement;

        if(this.output_panel_expanded) {
            console.log("Shrink output window");
            btn_output_panel_expand.classList.remove('hide');
            btn_output_panel_shrink.classList.add('hide');
            this.parameter_display.classList.remove('hide');
            gas_limit_display.classList.remove('hide');
            this.output_panel_expanded = false;
        } else {
            console.log("Expand output window");

            btn_output_panel_expand.classList.add('hide');
            btn_output_panel_shrink.classList.remove('hide');
            this.parameter_display.classList.add('hide');
            gas_limit_display.classList.add('hide');
            this.output_panel_expanded = true;
        }
    }

    /* should be in a utilities file */
    async copy_text_to_clipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            console.log('Text successfully copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }
}
