const function_list = document.getElementById('function_list');
const function_list_items = document.getElementById('function_list_items');
const btn_close_func_list = document.getElementById('btn_close_func_list');
const btn_open_func_list = document.getElementById('btn_open_func_list');
const search_func_list = document.getElementById('search_func_list');

let funcs = [];
let const_funcs = [];

search_func_list.addEventListener("input", (e) => {
    const search_value = e.target.value;
    localStorage.setItem(`list-functions-search`, search_value);
    clear_function_list();
    load_function_list();
});

search_func_list.value = localStorage.getItem(`list-functions-search`) || ``;

function open_list_functions() {
    function_list.classList.remove('hidden');
    btn_open_func_list.classList.add('hidden');
    btn_close_func_list.classList.remove('hidden');
    localStorage.setItem(`list-functions`, true);
}

function close_list_functions() {
    function_list.classList.add('hidden');
    btn_close_func_list.classList.add('hidden');
    btn_open_func_list.classList.remove('hidden');
    localStorage.setItem(`list-functions`, false);
}

const list_functions = localStorage.getItem(`list-functions`);
if (list_functions === `true`) {
    open_list_functions();
}

btn_close_func_list.addEventListener("click", () => {
    close_list_functions();
});

btn_open_func_list.addEventListener("click", () => {
    open_list_functions();
});

function clear_function_list() {
    function_list_items.innerHTML = ``;
}

function load_function_list() {
    let el_on_types = new Map();

    const filtered_funcs = funcs.filter((f) => {
        return f.name().indexOf(search_func_list.value) !== -1;
    });

    filtered_funcs.forEach((f) => {
        let el_on_type = el_on_types.get(f.on_type());

        if (!el_on_type) {
            el_on_type = document.createElement(`div`);
            const title = document.createElement(`div`);
            title.innerText = f.on_type() ? f.on_type() : `func`;
            el_on_type.append(title);
            el_on_types.set(f.on_type(), el_on_type);
            function_list_items.append(el_on_type);
        }

        const el_func = document.createElement(`div`);
        if (f.return_type()) {
            el_func.innerText = `${f.name()}(${f.params().join(", ")}) -> ${f.return_type()}`;
        } else {
            el_func.innerText = `${f.name()}(${f.params().join(", ")})`;
        }

        if (!f.is_on_instance() && f.on_type()) {
            el_func.innerText = `(static) ` + el_func.innerText;
        }

        el_on_type.append(el_func);
    });

    const filtered_const_funcs = const_funcs.filter((f) => {
        return f.name().indexOf(search_func_list.value) !== -1;
    });

    filtered_const_funcs.forEach((f) => {
        let el_on_type = el_on_types.get(f.for_type());

        if (!el_on_type) {
            el_on_type = document.createElement(`div`);
            const title = document.createElement(`div`);
            title.innerText = f.for_type();
            el_on_type.append(title);
            el_on_types.set(f.for_type(), el_on_type);
            function_list_items.append(el_on_type);
        }

        const el_func = document.createElement(`div`);
        el_func.innerText = `${f.for_type()}::${f.name()}(${f.params().join(", ")}) -> ${f.for_type()}`;
        el_on_type.append(el_func);
    });
}

export function load_funcs(silex) {
    funcs = silex.get_env_functions();
    const_funcs = silex.get_constants_functions();
    load_function_list();
}
