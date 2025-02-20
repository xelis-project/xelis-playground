import init, {Silex} from "/xelis_playground.js";
import HighlightedCode from './hightlighted-code.js';
import {buildCustomSelects} from './custom-select/index.js';
import './split-layout.js';
import {text_dot_loading} from './text-dot-loading.js';
import './export-modal.js';
import {load_funcs} from './func-list.js';

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
    const inputs = document.querySelectorAll(`input[name="entry_params_${program_entry_index}_input"]`);
    const params = [];
    inputs.forEach((element) => {
        const data_type = element.getAttribute(`data-type`);
        const value = element.value;
        // const parsed_value = parse_param(value, data_type);
        params.push(value);
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

btn_run.addEventListener('click', async () => {
    await run_program();
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

(function editor_selection_transform() {

    const OPEN_CHARS = '{([';
    const CLOSE_CHARS = '})]';
    const QUOTE_CHARS = '\'\"\`';

    let sel_start = null;
    let sel_end = null;
    let selected_text = "";

    // need to track last selection point in just in case the user moves
    // to a new selection point with the mouse.
    let prev_key = null;
    let prev_start = null;
    let prev_end = null;

    input_editor.addEventListener("selectionchange", (e) => {
        // getSelection broken in Firefox
        prev_start = sel_start;
        prev_end = sel_end;

        sel_start = input_editor.selectionStart;
        sel_end = input_editor.selectionEnd;

        if(sel_start !== sel_end) {
            selected_text = input_editor.value.substring(sel_start, sel_end);
        } else {
            selected_text = "";
        }
    });

    // The closing brace/quote is automatically added.
    // If the user types the closing character, we want to ignore it.
    function did_ignore_closing_char(open, close, key) {
        if((open.indexOf(prev_key) === close.indexOf(key))
            && [prev_start+1, prev_end+1, sel_start, sel_end].every((val, i, arr) => val === arr[0])
            && selected_text === "") {
            input_editor.selectionStart = sel_start + 1;
            input_editor.selectionEnd = sel_end + 1;
            prev_start = prev_end = sel_start = sel_end = null;
            return true;
        }
        return false;
    }

    function in_empty_surround() {

        const s = input_editor.selectionStart;
        const e = input_editor.selectionEnd;

        if (s === 0 || s !== e) {
            return false;
        }

        let surrounds = [];

        for (let i = 0; i < OPEN_CHARS.length; ++i) {
            surrounds.push(OPEN_CHARS[i].concat(CLOSE_CHARS[i]));
        }
        for (let i = 0; i < QUOTE_CHARS.length; ++i) {
            surrounds.push(QUOTE_CHARS[i].concat(QUOTE_CHARS[i]));
        }

        const two_chars = input_editor.value.substring(s - 1);
        for (let i = 0; i < surrounds.length; ++i) {
            if(two_chars.startsWith(surrounds[i])) {
                prev_key = surrounds[i][0];
                return true;
            }
        }

        prev_key = null;

        return false;
    }

    input_editor.addEventListener('keydown', (e) => {
        let key = e.key;

        const is_normal_key = !OPEN_CHARS
                .concat(CLOSE_CHARS)
                .concat(QUOTE_CHARS)
                .includes(key)
            && (key !== 'Shift') && (key !== 'Backspace');

        const is_close_bksp_with_no_selection = CLOSE_CHARS.concat('Backspace').includes(key)
            && !in_empty_surround()
            && sel_start !== sel_end;

        const is_bksp_outside_braces = ['Backspace'].includes(key)
            && !in_empty_surround();

        if(is_normal_key || is_close_bksp_with_no_selection || is_bksp_outside_braces) {
            selected_text = "";
            prev_key = null;
            return;
        }

        e.preventDefault();

        let close_key = "";

        switch(true) {
            case key === "Shift":
                return;
            case OPEN_CHARS.includes(key):
                close_key = CLOSE_CHARS[OPEN_CHARS.indexOf(key)];
                break;
            case CLOSE_CHARS.includes(key):
                if (did_ignore_closing_char(OPEN_CHARS, CLOSE_CHARS, key)) {
                    selected_text = "";
                    return;
                }
                break;
            case QUOTE_CHARS.includes(key): //quote
                close_key = key;
                if (did_ignore_closing_char(QUOTE_CHARS, QUOTE_CHARS, key)) {4
                    selected_text = "";
                    return;
                }
                break;

            case key === 'Backspace':
                const s = input_editor.value.substring(0, sel_start-1);
                const e = input_editor.value.substring(sel_start+1);
                input_editor.value = s + e;

                prev_key = null;
                key = "";
                close_key = "";
                selected_text = "";

                if(sel_start === 1) {
                    input_editor.selectionStart
                        = input_editor.selectionEnd
                        = sel_end
                        = sel_start
                        = sel_start = 0;
                    return;
                } else {
                    input_editor.selectionStart
                        = input_editor.selectionEnd
                        = sel_end
                        = sel_start
                        = sel_start - 2 < 0 ? 0 : sel_start - 2;
                }

                break;
            default:
                break;
        }

        const editor_pre_text = input_editor.value.substring(0, sel_start);
        const editor_post_text = input_editor.value.substring(sel_end);
        input_editor.value = editor_pre_text + key + selected_text + close_key + editor_post_text;
        input_editor.selectionStart = sel_start + 1;
        input_editor.selectionEnd = sel_end + 1;

        prev_key = key;

    });
})();

