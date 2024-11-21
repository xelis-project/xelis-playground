import init, { Silex } from "/xelis_playground.js";
import HighlightedCode from './hightlighted-code.js';

// TODO
// input to set max gas - default infinite (done)
// select entries after build (done)
// build & run button (done)
// provided input for each entry params (done)
// select for code example - fetch from github https://raw.githubusercontent.com/xelis-project/xelis-vm/refs/heads/master/examples/factorial.xel
// options to set tabsize
// style controls

HighlightedCode.useTheme('github-dark');

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

let program_code = null;
let program_entry_id = null;

function load_code() {
    let code = localStorage.getItem('code');
    if (!code) {
        code = `entry main() {
        println("Hello, World!");
        return 0;
    }`;
    }
    
    input_editor.value = code;
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

function add_entry(entry) {
    const opt = document.createElement(`option`);
    opt.innerText = entry.name();
    opt.value = entry.id();
    program_entries_select.appendChild(opt);
}

function add_entry_params(entry) {
    const container = document.createElement(`div`);
    container.id = `entry_params_${entry.id()}`;
    container.style.display = 'block';
    const params = entry.parameters();

    params.forEach((param) => {
        const item = document.createElement(`div`); 

        const title = document.createElement(`div`);
        title.innerText = `${param.name()} (${param._type()})`;

        const input = document.createElement(`input`);
        input.type = "text";
        input.name = `entry_params_${entry.id()}_input`;
        //input.id = `entry_params_${entry.id()}_${param.name()}`;

        item.appendChild(title);
        item.appendChild(input);
        container.appendChild(item);
    });

    if (params.length === 0) {
        container.innerHTML = `No parameters`;
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
        entries.forEach(entry => {
            add_entry(entry);
            add_entry_params(entry);
        });

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
    program_entry_id = e.target.value;

    program_entry_params.childNodes.forEach((element) => {
        element.style.display = 'none';
    });

    const params_container = document.getElementById(`entry_params_${program_entry_id}`);
    params_container.style.display = 'block';
});

function get_program_params() {
    const inputs = document.querySelectorAll(`input[name="entry_params_${program_entry_id}_input"]`);
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

function run_code() {
    const max_gas = input_max_gas.value || undefined;

    try {
        const program = silex.compile(program_code);

        output.innerText += "-------- Running --------\n";
        const params = get_program_params();
        let result  = silex.execute_program(program, program_entry_id, max_gas, params);

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

    output.scrollTop = output.scrollHeight;
}

btn_run.addEventListener('click', () => {
    run_code();
});