import { Silex } from '../public/xelis_playground';
import HighlightedCode from './highlighted_code';
import { CustomSelect } from './custom_select';
import { SplitLayout } from "./split_layout";
import { TextDotLoading } from './text_dot_loading';
import { ModalExport } from "./model_export";
import { FuncList } from './func_list';
import { EditorFeatures } from './editor_features';

export class App {
    silex: Silex;

    func_list: FuncList;
    modal_export: ModalExport;
    split_layout: SplitLayout;
    custom_select: CustomSelect;
    editor_features: EditorFeatures;

    input_editor: HTMLInputElement;
    output: HTMLElement;
    program_entries_select: HTMLSelectElement;
    program_entry_params: HTMLElement;
    btn_run: HTMLElement;
    btn_compile: HTMLElement;
    input_max_gas: HTMLInputElement;
    examples_select: HTMLSelectElement;
    btn_clear: HTMLElement;
    editor_lines: HTMLElement;
    btn_export: HTMLElement;
    tabsize_select: HTMLSelectElement;

    program_code: string;
    program_entry_index: number;

    constructor(silex: Silex) {
        this.silex = silex;
        this.input_editor = document.getElementById('input_editor') as HTMLInputElement;
        this.output = document.getElementById('output') as HTMLElement;
        this.program_entries_select = document.getElementById('program_entries_select') as HTMLSelectElement;
        this.program_entry_params = document.getElementById('program_entry_params') as HTMLElement;
        this.btn_run = document.getElementById('btn_run') as HTMLElement;
        this.btn_compile = document.getElementById('btn_compile') as HTMLElement;
        this.input_max_gas = document.getElementById('input_max_gas') as HTMLInputElement;
        this.examples_select = document.getElementById('examples_select') as HTMLSelectElement;
        this.btn_clear = document.getElementById('btn_clear') as HTMLElement;
        this.editor_lines = document.getElementById('editor_lines') as HTMLElement;
        this.btn_export = document.getElementById('btn_export') as HTMLElement;
        this.tabsize_select = document.getElementById('tabsize_select') as HTMLSelectElement;

        this.btn_compile.addEventListener('click', () => this.compile_code());
        this.program_entries_select.addEventListener('change', (e) => this.handle_program_entries_change(e));
        this.btn_run.addEventListener('click', async () => await this.run_program());
        this.btn_clear.addEventListener('click', () => this.clear_output());
        this.examples_select.addEventListener('change', async (e) => await this.handle_examples_change(e));
        this.input_editor.addEventListener('input', (e) => this.handle_input_change(e));
        this.tabsize_select.addEventListener('change', (e) => this.handle_tabsize_change(e));

        this.load_save();

        this.split_layout = new SplitLayout();
        this.func_list = new FuncList();
        this.func_list.load_funcs(this.silex);
        this.custom_select = new CustomSelect();
        this.editor_features = new EditorFeatures(this.input_editor, { auto_indent: true, auto_surround: true });

        HighlightedCode.useTheme('tomorrow-night-bright');
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
        this.input_editor.setAttribute(`tab-size`, tabsize);
    }

    set_editor_code(code: string) {
        this.input_editor.value = code;
        this.program_changed();
        this.set_editor_lines();
    }

    program_changed() {
        if (this.program_code && this.program_code !== this.input_editor.value) {
            this.btn_run.setAttribute("disabled", "");
            this.btn_export.setAttribute("disabled", "");
            this.output.innerHTML = "";
            this.reset_entries();
            this.program_code = "";
            this.program_entry_index = 0;
        }
    }

    save_code() {
        const code = this.input_editor.value;
        localStorage.setItem('code', code);
    }

    reset_entries() {
        this.program_entries_select.innerHTML = '<option>Not compiled yet</option>';
        this.program_entry_params.innerHTML = 'None';
        this.custom_select.build_selects();
    }

    clear_entries() {
        this.program_entries_select.innerHTML = '';
        this.program_entry_params.innerHTML = '';
    }

    add_entry(entry: any, index: number) {
        const opt = document.createElement(`option`);
        opt.textContent = entry.name();
        opt.value = index.toString();
        this.program_entries_select.appendChild(opt);
    }

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

    output_error(text: string, append: boolean = false) {
        return `<span class="out-err">${text}</span>`;
    }

    output_success(text: string, append: boolean = false) {
        return `<span class="out-success">${text}</span>`;
    }

    compile_code() {
        try {
            this.save_code();
            this.clear_entries();
            this.output.innerHTML = "Program saved locally.\n";
            this.btn_run.setAttribute('disabled', '');
            this.btn_export.setAttribute("disabled", "");

            const code = this.input_editor.value;
            localStorage.setItem('code', code);

            this.output.textContent += "------- Compiling -------\n";
            const program = this.silex.compile(code);

            const entries = program.entries();
            entries.forEach((entry: any, index: number) => {
                this.add_entry(entry, index);
                this.add_entry_params(entry, index);
            });

            if (entries.length === 0) {
                const opt = document.createElement(`option`);
                opt.textContent = "No entries available";
                opt.value = '-1';
                opt.classList.add(`disabled`);
                this.program_entries_select.appendChild(opt);

                this.btn_run.setAttribute('disabled', '');
            } else {
                this.btn_run.removeAttribute('disabled');
            }

            this.custom_select.build_selects();

            if (entries.length > 0) {
                this.program_entries_select.dispatchEvent(new Event('change'));
            }

            this.program_code = code;
            this.output.innerHTML += this.output_success("Compiled successfully!\n");

            this.btn_export.removeAttribute('disabled');
        } catch (e) {
            this.output.innerHTML += this.output_error("Error: " + e + "\n");
        }
    }

    handle_program_entries_change(e: Event) {
        this.program_entry_index = parseInt((e.target as HTMLSelectElement).value);

        Array.from(this.program_entry_params.children).forEach((element) => {
            element.classList.add(`hidden`);
        });

        const params_container = document.getElementById(`entry_params_${this.program_entry_index}`);
        if (params_container) params_container.classList.remove(`hidden`);
    }

    get_program_params() {
        const inputs = document.querySelectorAll(`input[name="entry_params_${this.program_entry_index}_input"]`);
        const params: string[] = [];
        inputs.forEach((element) => {
            if (element instanceof HTMLInputElement) {
                const data_type = element.getAttribute(`data-type`);
                const value = element.value;
                params.push(value);
            }
        });
        return params;
    }

    btn_run_set_running() {
        this.btn_run.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="spin">
            <path d="M12 22C17.5228 22 22 17.5228 22 12H19C19 15.866 15.866 19 12 19V22Z" />
            <path d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z" />
        </svg>
        Running
    `;
        this.btn_run.setAttribute(`disabled`, "");
    }

    btn_run_set_run() {
        this.btn_run.innerHTML = `
        <svg width="16" height="16" viewBox="-0.5 0 7 7" fill="currentColor">
            <g transform="translate(-347.000000, -3766.000000)">
                <g transform="translate(56.000000, 160.000000)">
                <path
                    d="M296.494737,3608.57322 L292.500752,3606.14219 C291.83208,3605.73542 291,3606.25002 291,3607.06891 L291,3611.93095 C291,3612.7509 291.83208,3613.26444 292.500752,3612.85767 L296.494737,3610.42771 C297.168421,3610.01774 297.168421,3608.98319 296.494737,3608.57322">
                </path>
                </g>
            </g>
        </svg>
        Run
    `;
        this.btn_run.removeAttribute(`disabled`);
    }

    async run_program() {
        let max_gas = null as bigint | null; // infinite

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

            let logs = result.logs();
            this.output.textContent += "\n";
            if (logs.length > 0) {
                this.output.textContent += logs.join("\n");
                this.output.textContent += "\n";
            }

            this.output.textContent += `-------- Result --------\n`;
            this.output.textContent += `Exit code: ${result.value()}\n`;
            this.output.textContent += `Executed in: ${result.elapsed_time()}\n`;
            this.output.textContent += `Gas usage: ${result.used_gas()} (${result.used_gas_formatted()} XEL)\n`;

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
        this.set_editor_lines();
        this.program_changed();
    }

    set_editor_lines() {
        const text = this.input_editor.value;
        const lines = text.split("\n");
        const count = lines.length;
        this.editor_lines.textContent = "";
        for (let i = 1; i <= count; i++) {
            const line = document.createElement(`div`);
            line.innerHTML = i.toString();
            this.editor_lines.appendChild(line);
        }
    }

    replace_spaces_indentation(data: string) {
        return data.replace(/^( +)/gm, (match) => {
            const tab_count = Math.floor(match.length / 4);
            return `\t`.repeat(tab_count);
        });
    }
}

//HighlightedCode.useTheme('tomorrow-night-bright');

//const program_editor = new ProgramEditor();
//program_editor.init();
//EditorFeatures.forEditor(program_editor.input_editor);