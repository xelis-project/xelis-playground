import init, { Silex } from "/xelis_playground.js";
import HighlightedCode from './hightlighted-code.js';
import { buildCustomSelects } from './custom-select/index.js';
import './split-layout.js';
import { text_dot_loading } from './text-dot-loading.js';
import './export-modal.js';
import { load_funcs } from './func-list.js';

HighlightedCode.useTheme('tomorrow-night-bright'); // github-dark

console.log("Loading WASM module...");
await init();
console.log("WASM module loaded!");

const silex = new Silex();
const input_editor = document.getElementById('input_editor');
const output = document.getElementById('output');
const program_entries_select = document.getElementById('program_entries_select');
const program_entry_params = document.getElementById('program_entry_params');
const btn_run = document.getElementById('btn_run');
const btn_compile = document.getElementById('btn_compile');
const input_max_gas = document.getElementById('input_max_gas');
const examples_select = document.getElementById('examples_select');
const btn_clear = document.getElementById('btn_clear');
const editor_lines = document.getElementById('editor_lines');
const btn_export = document.getElementById('btn_export');

load_funcs(silex);

let program_code = null;
let program_entry_index = null;

globalThis.get_program = function () {
    return silex.compile(program_code);
}

function set_editor_code(code) {
    input_editor.value = code;
    program_changed();
    set_editor_lines();
}

function program_changed() {
    if (program_code && program_code !== input_editor.value) {
        btn_run.setAttribute("disabled", "");
        btn_export.setAttribute("disabled", "");
        output.innerHTML = "";
        reset_entries();
        program_code = null;
        program_entry_index = null;
    }
}

function load_save() {
    // load code
    let code = localStorage.getItem('code');
    if (!code) {
        code = `entry main() {\r\tprintln("Hello, World!");\r\treturn 0;\r}`;
    }

    set_editor_code(code);

    // load tabsize
    const tabsize = localStorage.getItem('tabsize') || '4';
    tabsize_select.value = tabsize;
    input_editor.setAttribute(`tab-size`, tabsize);
}

load_save();
buildCustomSelects();

function save_code() {
    const code = input_editor.value;
    localStorage.setItem('code', code);
}

function reset_entries() {
    program_entries_select.innerHTML = '<option>Not compiled yet</option>';
    program_entry_params.innerHTML = 'None';
    buildCustomSelects();
}

function clear_entries() {
    program_entries_select.innerHTML = '';
    program_entry_params.innerHTML = '';
}

function add_entry(entry, index) {
    const opt = document.createElement(`option`);
    opt.textContent = entry.name();
    opt.value = index;
    program_entries_select.appendChild(opt);
}

function add_entry_params(entry, index) {
    const container = document.createElement(`div`);
    container.id = `entry_params_${index}`;
    container.classList.add(`spec-column`, `hidden`);
    const params = entry.parameters();

    params.forEach((param, param_index) => {
        const item = document.createElement(`div`);
        item.classList.add(`spec-param`);

        const title = document.createElement(`div`);
        title.textContent = `${param.name()} (${param._type()})`;

        const input = document.createElement(`input`);
        input.type = "text";
        input.autocomplete = `off`;
        input.autocapitalize = `off`;
        input.placeholder = `required`;
        input.classList.add('input');
        input.name = `entry_params_${param_index}_input`;

        item.appendChild(title);
        item.appendChild(input);
        container.appendChild(item);
    });

    if (params.length === 0) {
        container.innerHTML = `None`;
    }

    program_entry_params.appendChild(container);
}

function output_error(text, append = false) {
    return `<span class="out-err">${text}</span>`
}

function output_success(text, append = false) {
    return `<span class="out-success">${text}</span>`
}

function compile_code() {
    try {
        save_code();
        clear_entries();
        output.innerHTML = "Program saved locally.\n";
        btn_run.setAttribute('disabled', '');
        btn_export.setAttribute("disabled", "");

        const code = input_editor.value;
        localStorage.setItem('code', code);

        output.textContent += "------- Compiling -------\n";
        const program = silex.compile(code);

        const entries = program.entries();
        entries.forEach((entry, index) => {
            add_entry(entry, index);
            add_entry_params(entry, index);
        });

        buildCustomSelects();

        if (entries.length > 0) {
            program_entries_select.dispatchEvent(new Event('change'));
        }

        program_code = code;
        output.innerHTML += output_success("Compiled successfully!\n");
        btn_run.removeAttribute('disabled');
        btn_export.removeAttribute('disabled');
    } catch (e) {
        output.innerHTML += output_error("Error: " + e + "\n");
    }
}

btn_compile.addEventListener('click', () => {
    compile_code();
});

program_entries_select.addEventListener('change', (e) => {
    program_entry_index = e.target.value;

    Array.from(program_entry_params.children).forEach((element) => {
        element.classList.add(`hidden`);
    });

    const params_container = document.getElementById(`entry_params_${program_entry_index}`);
    if (params_container) params_container.classList.remove(`hidden`);
});

function get_program_params() {
    const inputs = document.querySelectorAll(`input[name="entry_params_${program_entry_index}_input"]`);
    const params = [];
    inputs.forEach((element) => {
        const value = parseFloat(element.value);
        if (!isNaN(value)) {
            params.push(value);
        } else {
            params.push(element.value);
        }
    });
    return params;
}

function btn_run_set_running() {
    btn_run.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="spin">
            <path d="M12 22C17.5228 22 22 17.5228 22 12H19C19 15.866 15.866 19 12 19V22Z" />
            <path d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z" />
        </svg>
        Running
    `;
    btn_run.setAttribute(`disabled`, "");
}

function btn_run_set_run() {
    btn_run.innerHTML = `
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
    btn_run.removeAttribute(`disabled`);
}

async function run_code() {
    const max_gas = input_max_gas.value || undefined;
    if (max_gas < 0) {
        output.innerHTML = output_error("Error: Max gas cannot be negative.\n");
        return;
    }

    btn_run_set_running();
    btn_export.setAttribute("disabled", "");

    let stop_dot_loading = null;

    try {
        if (silex.has_program_running()) {
            output.innerHTML = output_error("A program is already running!\n");
            return;
        }

        const program = silex.compile(program_code);
        const entry = program.entries()[program_entry_index];
        output.textContent = `-------- Running (${entry.name()} at index ${entry.id()}) --------\n`;
        stop_dot_loading = text_dot_loading(output, 3);

        const params = get_program_params();
        btn_compile.setAttribute("disabled", "");
        let result = await silex.execute_program(program, entry.id(), max_gas, params);
        stop_dot_loading();

        let logs = result.logs();
        output.textContent += "\n";
        if (logs.length > 0) {
            output.textContent += logs.join("\n");
            output.textContent += "\n";
        }

        output.textContent += `-------- Result --------\n`;
        output.textContent += `Exit code: ${result.value()}\n`;
        output.textContent += `Executed in: ${result.elapsed_time()}\n`;
        output.textContent += `Gas usage: ${result.used_gas()} (${result.used_gas_formatted()} XEL)\n`;

        // Also print the storage
        const storage = result.storage();
        console.log(storage);
        if (storage.length > 0) {
            output.textContent += `-------- Storage --------\n`;
            storage.forEach((item) => {
                output.textContent += `${item.key()}: ${item.value()}\n`;
            });
        }
    } catch (e) {
        if (stop_dot_loading) stop_dot_loading();
        output.innerHTML += output_error("Error: " + e + "\n");
    }

    btn_run_set_run();
    btn_export.removeAttribute("disabled");
    btn_compile.removeAttribute("disabled");

    // scroll down the output does not work for some reason
    // output.scrollTop = output.scrollHeight;
}

btn_run.addEventListener('click', async () => {
    await run_code();
});

btn_clear.addEventListener('click', () => {
    output.textContent = "";
});

// examples are using spaces indentation - fix by replacing with tabulation
function replace_spaces_indentation(data) {
    return data.replace(/^( +)/gm, (match) => {
        const tab_count = Math.floor(match.length / 4);
        return `\t`.repeat(tab_count);
    });
}

examples_select.addEventListener('change', async (e) => {
    const url = e.target.value;

    const res = await fetch(url);
    let code = await res.text();
    code = replace_spaces_indentation(code);
    set_editor_code(code);
});

function save_tabsize() {
    const tabsize = tabsize_select.value;
    localStorage.setItem("tabsize", tabsize);
}

tabsize_select.addEventListener('change', (e) => {
    const tabsize = e.target.value;
    input_editor.setAttribute(`tab-size`, tabsize);
    save_tabsize();
});

function set_editor_lines() {
    const text = input_editor.value;
    const lines = text.split("\n");
    const count = lines.length;
    editor_lines.textContent = "";
    for (let i = 1; i <= count; i++) {
        const line = document.createElement(`div`);
        line.innerHTML = i;
        editor_lines.appendChild(line);
    }
}

input_editor.addEventListener('input', (e) => {
    set_editor_lines();
    program_changed();
});
