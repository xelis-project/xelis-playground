import init, {Silex} from "/xelis_playground.js";
import HighlightedCode from './hightlighted-code.js';
import {buildCustomSelects} from './custom-select/index.js';
import './split-layout.js';
import {text_dot_loading} from './text-dot-loading.js';
import './export-modal.js';
import {load_funcs} from './func-list.js';
import EditorFeatures from './editor-features/index.js';
import {XelisXvmParser, ParameterBuilder} from "./parameter-builder/index.js";

HighlightedCode.useTheme('tomorrow-night-bright'); // github-dark

console.log("Loading WASM module...");
await init();
console.log("WASM module loaded!");

const silex = new Silex();
const input_editor = document.getElementById('input_editor');
const output = document.getElementById('output');
const btn_run = document.getElementById('btn_run');
const btn_compile = document.getElementById('btn_compile');
const input_max_gas = document.getElementById('input_max_gas');
const examples_select = document.getElementById('examples_select');
const btn_clear = document.getElementById('btn_clear');
const editor_lines = document.getElementById('editor_lines');
const btn_export = document.getElementById('btn_export');
const edit_params_btn = document.getElementById('edit-entry-params-btn');
const pb_ui = document.getElementById('modal_parameter_builder');

const pb_main_container = document.querySelector('div.parameter-builder-container');
const parameter_display = document.getElementById('parameter-display');
const pba_readonly = document.getElementById('pba-readonly');
const entry_call_container = document.querySelector(`#entry-call-container`);
const signature_container = document.querySelector(`#signature-container`);
const entry_call_btn = document.querySelector(`#entry-call-btn`);
const signature_btn = document.querySelector(`#signature-btn`);
const copy_btn = document.querySelector(`#copy-ec-btn`);
const entry_menu = document.getElementById('entry-menu');


load_funcs(silex);

let program_code = null;
let program_entry_index = null;
let xelis_xvm_param_parser = null;

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
        edit_params_btn.setAttribute('disabled', '');
        entry_call_btn.setAttribute('disabled', '');
        signature_btn.setAttribute('disabled', '');
        copy_btn.setAttribute('disabled', '');

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
    entry_call_container.replaceChildren();
    buildCustomSelects();
}

function clear_entries() {
    entry_call_container.replaceChildren();
    entry_menu.replaceChildren();
}

function add_entry(entry, index) {
    const link = document.createElement(`a`);
    link.href = "#";
    link.classList.add(`entry-link`);
    link.setAttribute(`data-entry-index`, index);
    link.textContent = entry.name();
    entry_menu.appendChild(link);

    link.addEventListener('click', (e) => {
       // const entry_index = e.target.getAttribute(`data-entry-index`);
        program_entry_index = index;

        const params = xelis_xvm_param_parser.parameter_builder_data[program_entry_index].parameters;

        if(params.length > 0) {
            edit_params_btn.removeAttribute('disabled');
        } else {
            edit_params_btn.setAttribute('disabled', '');
        }

        const entry_name = xelis_xvm_param_parser.parameter_builder_data[program_entry_index].name;
        const e_name_ro = document.querySelector(`#hud-entry-name`);
        e_name_ro.textContent = `${entry_name}`;

        signature_container.replaceChildren();
        params.forEach((param, index) => {
            const p_elem = document.createElement("parameter");
            const label = document.createElement("label");
            const sig = document.createElement("signature");

            label.textContent = `${param.name}: `;
            sig.textContent = `${param.signature}`;
            p_elem.appendChild(label);
            p_elem.appendChild(sig);
            signature_container.appendChild(p_elem);
        });

        entry_menu.style.display = 'none';
        entry_menu.classList.remove('dropdown-content');


        setTimeout(function() {
            entry_menu.style.display = '';
            entry_menu.classList.add('dropdown-content');
        }, 500);

        update_ro_argument_display();
    });

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

        edit_params_btn.setAttribute('disabled', '');
        entry_call_btn.setAttribute('disabled', '');
        signature_btn.setAttribute('disabled', '');
        copy_btn.setAttribute('disabled', '');


        const code = input_editor.value;
        localStorage.setItem('code', code);

        output.textContent += "------- Compiling -------\n";
        const program = silex.compile(code);

        xelis_xvm_param_parser = new XelisXvmParser();

        const entries = program.entries();
        entries.forEach((entry, index) => {
            xelis_xvm_param_parser.make_schema_from_entry(entry);
            add_entry(entry, index);

            let pb_entry_container = document.getElementById(`pb_entry_container_${index}`);
            let pb_input_container = null;
            let arg_container = null;

            if (pb_entry_container !== null) {
                pb_input_container = pb_entry_container.querySelector(`div.pb-input-container`);
                arg_container = pb_entry_container.querySelector(`div.pb-arguments-container`);
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
                pb_main_container.appendChild(pb_entry_container);
            }

            pb_entry_container.setAttribute('data-pbe-index', index);

            let pb_opts = {};
            pb_opts.pb_container = pb_input_container;
            pb_opts.arg_container = arg_container;

            const parsed_entry = xelis_xvm_param_parser.parameter_builder_data[index];
            ParameterBuilder.build_from_schema(parsed_entry.parameters, pb_opts);
        });

        if (entries.length === 0) {
            btn_run.setAttribute('disabled', '');
        } else {
            btn_run.removeAttribute('disabled');
        }

        buildCustomSelects();

        if (entries.length > 0) {
            const first_menu_link = document.querySelector(`#entry-menu a`);
            first_menu_link.click();
        }

        program_code = code;
        output.innerHTML += output_success("Compiled successfully!\n");

        btn_export.removeAttribute('disabled');
        edit_params_btn.removeAttribute('disabled');
        entry_call_btn.removeAttribute('disabled');
        entry_call_btn.classList.add('selected');
        signature_btn.removeAttribute('disabled');
        copy_btn.removeAttribute('disabled');

        //update_ro_argument_display();

        // console.log(xelis_xvm_param_parser.parameter_builder_data);

        //const xvm_signature_builder_test = new XelisXvmParser();
        //console.log(xvm_signature_builder_test.signature_to_json("struct(StructType(Struct { id: 1, fields: [String, Array(U8)] }))"));

    } catch (e) {
        output.innerHTML += output_error("Error: " + e + "\n");
    }
}

// function parse_param(param, ty) {
//     let is_optional = ty.startsWith("optional<");

//     if (is_optional) {
//         if (param === "" || param === null) {
//             return null;
//         }

//         // Split the inner type
//         const inner_ty = ty.slice(9, -1);
//         return parse_param(param, inner_ty);
//     }

//     switch (ty) {
//         case "string":
//             return param;
//         case "bool":
//             return param === "true";
//         default:
//             return parseFloat(param);
//     }
// }

function get_program_params() {
    const params = [];
    const pbe_params_elems = document.querySelectorAll(`#pb_entry_container_${program_entry_index} > div.pb-arguments-container > pre`);
    pbe_params_elems.forEach(pbe => {
        const content = pbe.textContent;
        params.push(typeof content === 'number' ? content.toString() : content);
    });

    return params;
}

function btn_run_set_running() {
    btn_run.textContent = "Running";
    btn_run.setAttribute(`disabled`, "");
}

function btn_run_set_run() {
    btn_run.textContent = "Run";
    btn_run.removeAttribute(`disabled`);
}

async function run_program() {
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

/** Opens the parameter builder modal.
 * TODO: Best to move this into the program window, and get rid of the modal.
 * */
edit_params_btn.addEventListener('click', () => {
    pb_ui.classList.remove('hidden');

    for (const pbe of pb_main_container.children) {
        if(parseInt(pbe.getAttribute("data-pbe-index")) === program_entry_index) {
            const entry_stat = document.querySelector(`.entry-stat > span`);
            if(entry_stat !== null) {
                entry_stat.textContent = `${xelis_xvm_param_parser.parameter_builder_data[program_entry_index].name}`;
            }

            const param_stat = document.querySelector(`.param-stat > span`);
            if(param_stat !== null) {
                param_stat.textContent = `${xelis_xvm_param_parser.parameter_builder_data[program_entry_index].parameters.length}`;
            }

            pbe.classList.remove('hide');
        } else {
            pbe.classList.add('hide');
        }
    }
});

function update_ro_argument_display() {
    if(entry_call_container !== null) {
        entry_call_container.replaceChildren();
        const e_name = xelis_xvm_param_parser.parameter_builder_data[program_entry_index].name;
        const func_name = document.createElement(`entry-name`);
        func_name.classList.add(`code`);
        func_name.textContent = `${e_name}(`;
        entry_call_container.appendChild(func_name);
        const pba_container = document.querySelector(`#pb_entry_container_${program_entry_index} > div.pb-arguments-container`);
        if(pba_container.hasChildNodes()) {
            for (const node of pba_container.childNodes) {
                entry_call_container.appendChild(node.cloneNode(true));
            }
        }
        const close_func_name = document.createElement(`entry-name`);
        close_func_name.classList.add(`code`);
        close_func_name.textContent = `)`;
        entry_call_container.appendChild(close_func_name);
    }
}

btn_run.addEventListener('click', async () => {
    await run_program();
});

btn_clear.addEventListener('click', () => {
    output.textContent = "";
});

entry_call_btn.addEventListener('click', () => {
    signature_container.classList.add('hide');
    entry_call_container.classList.remove('hide');
});

signature_btn.addEventListener('click', () => {
    signature_container.classList.remove('hide');
    entry_call_container.classList.add('hide');
});

btn_compile.addEventListener('click', () => {
    compile_code();
});

/* We update the readonly display whenever the parameter builder changes */
document.addEventListener("pb-argument-did-change", () => {
    update_ro_argument_display();
});


EditorFeatures.forEditor(input_editor);