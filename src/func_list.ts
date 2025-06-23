import { App } from "./app";

export class FuncList {
  app: App;
  element: HTMLElement;
  items: HTMLElement;
  btn_toggle_func_list: HTMLButtonElement;
  search_func_list: HTMLInputElement;
  is_opened: boolean;

  funcs: any[];
  const_funcs: any[];

  constructor(app: App) {
    this.app = app;

    this.element = document.getElementById('function_list') as HTMLElement;
    this.items = document.getElementById('function_list_items') as HTMLElement;
    this.btn_toggle_func_list = document.getElementById('btn_toggle_func_list') as HTMLButtonElement;
    this.search_func_list = document.getElementById('search_func_list') as HTMLInputElement;

    this.funcs = [];
    this.const_funcs = [];

    this.search_func_list.addEventListener("input", (e) => this.handle_search_input(e));
    this.search_func_list.value = localStorage.getItem(`list-functions-search`) || ``;
    this.btn_toggle_func_list.addEventListener("click", () => this.toggle_list_functions());

    const list_functions = localStorage.getItem(`list-functions`);
    this.is_opened = false;
    if (list_functions === `true`) {
      this.open_list_functions();
    }
  }

  handle_search_input(e: Event) {
    const search_value = (e.target as HTMLInputElement).value;
    localStorage.setItem(`list-functions-search`, search_value);
    this.clear_function_list();
    this.load_function_list();
  }

  toggle_list_functions() {
    if (this.element.classList.contains("hidden")) {
      this.open_list_functions();
    } else {
      this.close_list_functions();
    }

    this.app.split_layout.update_split();
  }

  open_list_functions() {
    this.element.classList.remove('hidden');
    localStorage.setItem(`list-functions`, 'true');
    this.is_opened = true;
  }

  close_list_functions() {
    this.element.classList.add('hidden');
    localStorage.setItem(`list-functions`, 'false');
    this.is_opened = false;
  }

  clear_function_list() {
    this.items.innerHTML = ``;
  }

  load_function_list() {
    let el_on_types = new Map<string, HTMLElement>();

    const filtered_funcs = this.funcs.filter((f) => {
      return f.name().indexOf(this.search_func_list.value) !== -1 || f.syscall_id() == this.search_func_list.value;
    });

    filtered_funcs.forEach((f) => {
      let el_on_type = el_on_types.get(f.on_type());

      if (!el_on_type) {
        el_on_type = document.createElement(`div`);
        const title = document.createElement(`div`);
        title.innerText = f.on_type() ? f.on_type() : `func`;
        el_on_type.append(title);
        el_on_types.set(f.on_type(), el_on_type);
        this.items.append(el_on_type);
      }

      const el_func = document.createElement(`div`);
      if (f.return_type()) {
        el_func.innerText = `${f.name()}(${f.params().join(", ")}) -> ${f.return_type()}`;
      } else {
        el_func.innerText = `${f.name()}(${f.params().join(", ")})`;
      }

      el_func.setAttribute(`title`, `Syscall id: ${f.syscall_id()}`);

      if (!f.is_on_instance() && f.on_type()) {
        el_func.innerText = `${f.on_type()}::` + el_func.innerText;
      }

      el_on_type.append(el_func);
    });

    const filtered_const_funcs = this.const_funcs.filter((f) => {
      return f.name().indexOf(this.search_func_list.value) !== -1;
    });

    let el_const_on_types = new Map<string, HTMLElement>();

    const separator = document.createElement(`h3`);
    separator.innerText = `-- Const functions (executed at compile time only) --`;
    this.items.append(separator);

    filtered_const_funcs.forEach((f) => {
      let el_on_type = el_const_on_types.get(f.for_type());

      if (!el_on_type) {
        el_on_type = document.createElement(`div`);
        const title = document.createElement(`div`);
        title.innerText = f.for_type();
        el_on_type.append(title);
        el_const_on_types.set(f.for_type(), el_on_type);
        this.items.append(el_on_type);
      }

      const el_func = document.createElement(`div`);
      el_func.innerText = `(const) ${f.for_type()}::${f.name()}(${f.params().join(", ")}) -> ${f.for_type()}`;
      el_on_type.append(el_func);
    });
  }

  load_funcs(silex: any) {
    this.funcs = silex.get_env_functions();
    this.const_funcs = silex.get_constants_functions();
    this.load_function_list();
  }
}
