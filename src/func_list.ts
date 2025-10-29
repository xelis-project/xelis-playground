import { App } from "./app";

export class FuncList {
  app: App;
  element: HTMLElement;
  items: HTMLElement;
  //btn_toggle_func_list: HTMLButtonElement;
  search_func_list: HTMLInputElement;
  //is_opened: boolean;

  search_results_default_show: boolean = false;

  funcs: any[];
  const_funcs: any[];

  constructor(app: App) {
    this.app = app;

    this.element = document.getElementById('function_list') as HTMLElement;
    this.items = document.getElementById('function_list_items') as HTMLElement;
    //this.btn_toggle_func_list = document.getElementById('btn_toggle_func_list') as HTMLButtonElement;
    this.search_func_list = document.getElementById('search_func_list') as HTMLInputElement;

    this.funcs = [];
    this.const_funcs = [];

    this.search_func_list.addEventListener("input", (e) => this.handle_search_input(e));
    this.search_func_list.value = localStorage.getItem(`list-functions-search`) || ``;
    //this.btn_toggle_func_list.addEventListener("click", () => this.toggle_list_functions());

    // const list_functions = localStorage.getItem(`list-functions`);
    // this.is_opened = false;
    // if (list_functions === `true`) {
    //   this.open_list_functions();
    // }
  }

  handle_search_input(e: Event) {
    const search_value = (e.target as HTMLInputElement).value;
    localStorage.setItem(`list-functions-search`, search_value);
    this.clear_function_list();
    this.load_function_list();
  }

  // toggle_list_functions() {
  //   if (this.element.classList.contains("hidden")) {
  //     this.open_list_functions();
  //   } else {
  //     this.close_list_functions();
  //   }
  //
  //   this.app.split_layout.update_split();
  // }

  // open_list_functions() {
  //   this.element.classList.remove('hidden');
  //   localStorage.setItem(`list-functions`, 'true');
  //   this.is_opened = true;
  // }

  // close_list_functions() {
  //   this.element.classList.add('hidden');
  //   localStorage.setItem(`list-functions`, 'false');
  //   this.is_opened = false;
  // }

  clear_function_list() {
    this.items.innerHTML = ``;
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  load_function_list() {
      const _thisFuncList = this;

    let el_on_types = new Map<string, HTMLElement>();

    const filtered_funcs = this.funcs.filter((f) => {
      // Search by syscall, on_type, and name
      return f.name().indexOf(this.search_func_list.value) !== -1
        || f.syscall_id() == this.search_func_list.value
        || (f.on_type() != null && f.on_type().toLowerCase().indexOf(this.search_func_list.value.toLowerCase()) !== -1);
    });

      let method_container: HTMLElement;

      if(filtered_funcs.length > 0) {
          const separator = document.createElement(`div`);
          separator.classList.add(`panel-title`, `title`, `const-section-title`);
          separator.innerText = `Standard functions`;

          const note = document.createElement(`div`);
          note.classList.add(`note`);
          note.innerText = `(Built in functions)`;

          separator.append(note);
          this.items.append(separator);
      }


    filtered_funcs.forEach((f) => {
      let el_on_type = el_on_types.get(f.on_type());

      if (!el_on_type) {
        el_on_type = document.createElement(`div`);
        el_on_type.classList.add(`section-header`, `info-block`, `accordion`);
        const title = document.createElement(`div`);
        title.innerText = f.on_type() ? f.on_type() : `func`;
        el_on_type.append(title);
        el_on_types.set(f.on_type(), el_on_type);

          // make the method container for this type
          method_container = document.createElement(`div`);
          method_container.classList.add(`method-container`, (_thisFuncList.search_results_default_show ? `active` : `inactive`));

          this.items.append(el_on_type);
          this.items.append(method_container);

          el_on_type.addEventListener("click", function() {
              this.classList.toggle("active");
              const mc = this.nextElementSibling as HTMLElement;

              if (mc.classList.contains("active")) {
                  mc.classList.remove("active");
                  mc.classList.add("inactive");
              } else if (mc.classList.contains("inactive")) {
                  mc.classList.add("active");
                  mc.classList.remove("inactive");
              }
          });
      }

      const el_func = document.createElement(`div`);
      el_func.classList.add(`func-item`);

      const name = this.escapeHtml(f.name());
      const params = f.params().map(this.escapeHtml).join(", ");
      const retType = f.return_type() ? this.escapeHtml(f.return_type()) : "";
      const onType = f.on_type() ? this.escapeHtml(f.on_type()) : "";

      if (f.return_type()) {
        el_func.innerHTML = `<function>${name}</function><parameter>(${params})</parameter> <arrow>⟶</arrow> <ret_type>${retType}</ret_type>`;
      } else {
        el_func.innerHTML = `<function>${name}</function><parameter>(${params})</parameter>`;
      }

      el_func.classList.add(`with-tooltip`);
      el_func.setAttribute("data-tooltip", `Syscall id: ${f.syscall_id()}, gas cost: ${f.gas_cost_formatted()}`);

      if (!f.is_on_instance() && f.on_type()) {
        el_func.innerHTML = `<ret_type>${onType}</ret_type>::` + el_func.innerHTML;
      }

      method_container.append(el_func);
    });

    const filtered_const_funcs = this.const_funcs.filter((f) => {
      return f.name().indexOf(this.search_func_list.value) !== -1;
    });

    let el_const_on_types = new Map<string, HTMLElement>();

    if(filtered_const_funcs.length > 0) {
        const separator = document.createElement(`div`);
        separator.classList.add(`panel-title`, `title`, `const-section-title`);
        separator.innerText = `Const functions`;

        const note = document.createElement(`div`);
        note.classList.add(`note`);
        note.innerText = `(executed at compile time only)`;

        separator.append(note);
        this.items.append(separator);
    }


    filtered_const_funcs.forEach((f) => {
      let el_on_type = el_const_on_types.get(f.for_type());

      if (!el_on_type) {
          el_on_type = document.createElement(`div`);
          el_on_type.classList.add(`section-header`, `info-block`, `accordion`);
        const title = document.createElement(`div`);
        title.innerText = f.for_type();
        el_on_type.append(title);
        el_const_on_types.set(f.for_type(), el_on_type);

          // make the method container for this type
          method_container = document.createElement(`div`);
          method_container.classList.add(`method-container`, (_thisFuncList.search_results_default_show ? `active` : `inactive`));

          this.items.append(el_on_type);
          this.items.append(method_container);

          el_on_type.addEventListener("click", function() {
              this.classList.toggle("active");
              const mc = this.nextElementSibling as HTMLElement;

              if (mc.classList.contains("active")) {
                  mc.classList.remove("active");
                  mc.classList.add("inactive");
              } else if (mc.classList.contains("inactive")) {
                  mc.classList.add("active");
                  mc.classList.remove("inactive");
              }
          });
      }

      const el_func = document.createElement(`div`);
        el_func.innerHTML = `(const) <ret_type>${f.for_type()}</ret_type>::<function>${f.name()}</function>(${f.params().join(", ")}) <arrow>⟶</arrow> <ret_type>${f.for_type()}</ret_type>`;
      method_container.append(el_func);
    });
  }

  load_funcs(silex: any) {
    this.funcs = silex.get_env_functions();
    this.const_funcs = silex.get_constants_functions();
    console.log(this.funcs);
    console.log(this.const_funcs);
    this.load_function_list();
  }
}
