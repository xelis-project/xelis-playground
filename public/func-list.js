const function_list = document.getElementById('function_list');
const btn_close_func_list = document.getElementById('btn_close_func_list');
const btn_open_func_list = document.getElementById('btn_open_func_list');

btn_close_func_list.addEventListener("click", () => {
    function_list.classList.add('hidden');
    btn_close_func_list.classList.add('hidden');
    btn_open_func_list.classList.remove('hidden');
});

btn_open_func_list.addEventListener("click", () => {
    function_list.classList.remove('hidden');
    btn_open_func_list.classList.add('hidden');
    btn_close_func_list.classList.remove('hidden');
});

export function load_function_list(silex) {
    let funcs = silex.get_env_functions();
    const el_wrap = document.createElement(`div`);
    function_list.append(el_wrap);

    let el_types = new Map();
    funcs.forEach((f) => {
        let el_type = el_types.get(f.f_type());
        
        if (!el_type) {
            el_type = document.createElement(`div`);
            const title = document.createElement(`div`)
            title.innerText = f.f_type();
            el_type.append(title);
            el_types.set(f.f_type(), el_type);
            el_wrap.append(el_type);
        }

        const el_func = document.createElement(`div`);
        el_func.innerHTML = f.name() + "(" + f.params() + ")";
        el_type.append(el_func);
    });
}