import init, { Silex } from "/xelis_playground.js";
import HighlightedCode from './hightlighted-code.js';

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
const editor_lines = document.getElementById('editor_lines')

let program_code = null;
let program_entry_index = null;

function set_editor_code(code) {
    input_editor.value = code;
    set_editor_lines();
}

function load_code() {
    let code = localStorage.getItem('code');
    if (!code) {
        code = `entry main() {
    println("Hello, World!");
    return 0;
}`;
    }
    
    set_editor_code(code);
}

load_code();

function save_code() {
    const code = input_editor.value;
    localStorage.setItem('code', code);
}

function reset_entries() {
    program_entries_select.innerHTML = '';
    program_entry_params.innerHTML = '';
}

function add_entry(entry, index) {
    const opt = document.createElement(`option`);
    opt.innerText = entry.name();
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
        title.innerText = `${param.name()} (${param._type()})`;

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

function compile_code() {
    save_code();
    reset_entries();
    btn_run.setAttribute('disabled', '');

    const code = input_editor.value;
    localStorage.setItem('code', code);

    try {
        output.innerText = "------- Compiling -------\n";
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
        output.innerText += "Compiled successfully!\n";
        btn_run.removeAttribute('disabled');
    } catch (e) {
        output.innerText += "Error: " + e + "\n";
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

async function run_code() {
    const max_gas = input_max_gas.value || undefined;

    if (silex.has_program_running()) {
        output.innerText += "A program is already running!\n";
        return;
    }

    try {
        const program = silex.compile(program_code);
        const entry = program.entries()[program_entry_index];

        output.innerText += `-------- Running (${entry.name()} at index ${entry.id()}) --------\n`;
        const params = get_program_params();
        let result = await silex.execute_program(program, entry.id(), max_gas, params);

        let logs = result.logs();
        if (logs.length > 0) {
            output.innerText += `Output:\n`;
            output.innerText += logs.join("\n");
            output.innerText += "\n";
        }

        output.innerText += `Exit code: ${result.value()}\n`;
        output.innerText += `Executed in: ${result.elapsed_time()}\n`;
        output.innerText += `Gas usage: ${result.used_gas()}\n`;
    } catch (e) {
        output.innerText += "Error: " + e + "\n";
    }

    // scroll down the output does not work for some reason
    // output.scrollTop = output.scrollHeight;
}

btn_run.addEventListener('click', async () => {
    await run_code();
});

btn_clear.addEventListener('click', () => {
    output.innerText = "";
});

examples_select.addEventListener('change', async (e) => {
    const url = e.target.value;

    const res = await fetch(url);
    const code = await res.text();
    set_editor_code(code);
});

tabsize_select.addEventListener('change', (e) => {
    const tabsize = e.target.value;
    input_editor.setAttribute(`tab-size`, tabsize);
});

function set_editor_lines() {
    const text = input_editor.value;
    const lines = text.split("\n");
    const count = lines.length;
    editor_lines.innerText = "";
    for (let i =0;i<count;i++) {
        const line = document.createElement(`div`);
        line.innerHTML = i;
        editor_lines.appendChild(line);
    }
}

input_editor.addEventListener('input', (e) => {
    set_editor_lines();
});
