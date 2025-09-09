import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-rust';
import 'ace-builds/src-noconflict/theme-tomorrow_night_bright';

import { Silex } from '../public/xelis_playground';
import { CustomSelect } from './custom_select';
import { SplitLayout } from "./split_layout";
import { TextDotLoading } from './text_dot_loading';
import { ModalExport } from "./model_export";
import { FuncList } from './func_list';
import { Modal } from './modal';
import {FileMetaData, Project, ProjectManager} from './project';
import { XVMParamParser } from './parameter_builder/xvm_param_parser';
import { ParameterBuilder } from './parameter_builder/parameter_builder';
import {PanelOptions, UIContainers} from "./UIContainers";

import HistoryIcon from "./resources/icons/history-icon.svg";
import ReuseIcon from "./resources/icons/recycle-icon.svg";

import {Utils} from "./Utils";

type EntryCallParam = [string: string];

export class App {
    silex: any;

    modal: Modal;
    func_list: FuncList;
    modal_export: ModalExport;
    split_layout: SplitLayout;
    custom_select: CustomSelect;

    editor: ace.Editor;
    editor_has_unsaved_changes: boolean = false;
    output: HTMLElement;
    //program_entries_select: HTMLSelectElement;
    //program_entry_params: HTMLElement;
    btn_run: HTMLElement;
    btn_compile: HTMLElement;
    input_max_gas: HTMLInputElement;
    btn_output_clear: HTMLElement;
    btn_output_copy: HTMLElement;
    btn_output_panel_toggle: HTMLElement;
    editor_lines: HTMLElement;
    btn_export: HTMLElement;
    tabsize_select: HTMLSelectElement;

    btn_edit_params: HTMLElement;
    //pb_ui: HTMLElement;
    pb_main_container: HTMLElement;
    parameter_display: HTMLElement;
    pba_readonly: HTMLElement;
    entry_call_container: HTMLElement;
    signature_container: HTMLElement;
    btn_entry_call: HTMLElement;
    btn_signature: HTMLElement;
    btn_call_history: HTMLElement;
    btn_reuse_entry_calls: HTMLElement;
    btn_copy: HTMLElement;

    /* Editor Project Panel */
    btn_project_panel: HTMLElement;
    btn_project_panel_close: HTMLElement;

    /*Editor options popup*/
    btn_editor_options: HTMLElement;
    btn_editor_load_file: HTMLElement;
    btn_editor_save_code: HTMLElement;
    /* end editor options popup*/

    entry_menu: HTMLElement;
    arg_ro_message: HTMLElement;

    program_code: string;
    program_entry_index: number;
    xvm_param_parser: XVMParamParser;
    output_panel_expanded: boolean = false;

    project_manager: ProjectManager;
    btn_close_arg_editor: HTMLElement;

    call_history: Record<string, string>[] = [];
    prefs_CALL_HISTORY_MAX = 10;
    prefs_REUSE_ENTRY_CALLS = true;

    constructor(silex: Silex) {
        const _thisApp = this;

        this.silex = silex;
        this.program_code = "";
        this.program_entry_index = 0;
        this.xvm_param_parser = new XVMParamParser();

        this.output = document.getElementById('output') as HTMLElement;
        //this.program_entries_select = document.getElementById('program_entries_select') as HTMLSelectElement;
        //this.program_entry_params = document.getElementById('program_entry_params') as HTMLElement;
        this.btn_run = document.getElementById('btn_run') as HTMLElement;
        this.btn_compile = document.getElementById('btn_editor_compile') as HTMLElement;
        this.input_max_gas = document.getElementById('input_max_gas') as HTMLInputElement;

        this.btn_output_clear = document.getElementById('btn_output_clear') as HTMLElement;
        this.btn_output_copy = document.getElementById('btn_output_copy') as HTMLElement;
        this.btn_output_panel_toggle = document.getElementById('btn_output_panel_toggle') as HTMLElement;
        this.editor_lines = document.getElementById('editor_lines') as HTMLElement;
        this.btn_export = document.getElementById('btn_export') as HTMLElement;
        this.tabsize_select = document.getElementById('tabsize_select') as HTMLSelectElement;

        this.btn_edit_params = document.getElementById('edit-entry-params-btn') as HTMLButtonElement;
        this.btn_entry_call = document.querySelector(`#entry-call-btn`) as HTMLButtonElement;
        this.btn_signature = document.querySelector(`#signature-btn`) as HTMLButtonElement;
        this.btn_copy = document.querySelector(`#copy-ec-btn`) as HTMLButtonElement;

        /* Argument Editor (Parameter Builder)*/
        this.pb_main_container = UIContainers.get_panel_selection_container('#parameter_builder_container') as HTMLElement;
        this.parameter_display = document.getElementById('parameter-display') as HTMLElement;
        this.pba_readonly = document.getElementById('pba-readonly') as HTMLElement;
        this.entry_call_container = document.querySelector(`#entry-call-container`) as HTMLElement;
        this.signature_container = document.querySelector(`#signature-container`) as HTMLElement;
        this.entry_menu = document.getElementById('entry-menu') as HTMLElement;
        this.arg_ro_message = document.querySelector(`#pba-readonly .message`) as HTMLElement;
        this.btn_close_arg_editor = document.querySelector(`#btn_close_arg_editor`) as HTMLElement;
        /* end Argument Editor (Parameter Builder)*/

        /* editor Project panel */
        this.btn_project_panel = document.querySelector(`#btn_editor_project`) as HTMLElement;
        this.btn_project_panel_close = document.querySelector(`#btn_close_project_panel`) as HTMLElement;
        /* end editor Project panel */

        /** editor options panel **/
        this.btn_editor_options = document.querySelector(`#btn_editor_options`) as HTMLElement;
        this.btn_editor_load_file = document.querySelector(`#btn_editor_load_file`) as HTMLElement;
        this.btn_editor_save_code = document.querySelector(`#btn_editor_save_code`) as HTMLElement;
        /* end editor options panel*/

        this.btn_export.addEventListener('click', () => this.open_modal_export());
        this.btn_compile.addEventListener('click', () => this.compile_code());
        this.btn_copy.addEventListener('click', () => this.copy_text_to_clipboard(this.entry_call_container.textContent || ""));
        this.btn_run.addEventListener('click', async () => await this.run_program());
        this.btn_output_clear.addEventListener('click', () => this.clear_output());

        this.btn_output_copy.addEventListener('click', () => this.copy_text_to_clipboard(this.output.textContent || ""));
        this.btn_output_panel_toggle.addEventListener('click', () => this.output_panel_toggle(undefined));

        this.btn_call_history = document.querySelector(`#btn-call-history`) as HTMLButtonElement;
        HistoryIcon.classList.add("icon", "history-icon");
        _thisApp.btn_call_history.innerHTML =  Utils.convertSvgElementToHtml(HistoryIcon) as string;

        this.btn_reuse_entry_calls = document.querySelector(`#btn-reuse-last-call`) as HTMLButtonElement;
        ReuseIcon.classList.add("icon", "recycle-icon");
        _thisApp.btn_reuse_entry_calls.innerHTML =  Utils.convertSvgElementToHtml(ReuseIcon) as string;
        _thisApp.btn_reuse_entry_calls.addEventListener("click", e => {
            const data_toggle = _thisApp.btn_reuse_entry_calls.getAttribute("data-toggle");
            if(data_toggle !== undefined && data_toggle !== null) {
                if(data_toggle === "on") {
                    _thisApp.prefs_REUSE_ENTRY_CALLS = false;
                    _thisApp.btn_reuse_entry_calls.setAttribute("data-tooltip", "Enable call reuse");
                    _thisApp.btn_reuse_entry_calls.setAttribute("data-toggle", "off");
                } else {
                    _thisApp.prefs_REUSE_ENTRY_CALLS = true;
                    _thisApp.btn_reuse_entry_calls.setAttribute("data-tooltip", "Disable call reuse");
                    _thisApp.btn_reuse_entry_calls.setAttribute("data-toggle", "on");
                }

                _thisApp.compile_code()
            }

            localStorage.setItem('reuse_entry_calls', JSON.stringify(_thisApp.prefs_REUSE_ENTRY_CALLS));
        });

        this.btn_close_arg_editor.addEventListener("click", () => {
            const after_close = () => {
                this.editor.focus();
            }

            UIContainers.panel_close(UIContainers.panel_options({initiator: this.btn_close_arg_editor, after_close: after_close} as PanelOptions));
        });

        this.btn_editor_save_code.addEventListener('click', (_) => {

            const after_close = () => {
                [this.btn_project_panel, this.btn_editor_options,
                    this.btn_compile].forEach(b => b.removeAttribute("disabled"));

                this.editor.focus();
            }

            const after_open = () => {
                [this.btn_project_panel, this.btn_editor_options,
                    this.btn_compile].forEach(b => b.setAttribute("disabled", ""));
                this.project_manager.ui_save_code_to_project(UIContainers.panel_options({initiator: this.btn_editor_save_code, after_close: after_close} as PanelOptions));
            }

            UIContainers.panel_toggle(UIContainers.panel_options({initiator: this.btn_editor_save_code, after_open: after_open, after_close: after_close} as PanelOptions));
        });

        this.btn_project_panel.addEventListener('click', (evt) => {
            const project_panel_open = () => {
                [this.btn_editor_save_code, this.btn_editor_options,
                    this.btn_compile].forEach(b => b.setAttribute("disabled", ""));


                document.dispatchEvent(new CustomEvent("project-container-external-open", {
                    detail: {
                        container: "editor-main",
                    },
                }));
            }

            const project_panel_close = () => {
                console.log("sending project-container-external-close");
                document.dispatchEvent(new CustomEvent("project-container-external-close", {
                    detail: {
                        container: "editor-main",
                    },
                }));

                this.notify_screen_left_reset();
            }

            const panel_container_id = this.btn_project_panel.getAttribute("data-panel-id");
            if(panel_container_id === null) {
                console.error("btn_editor_project has no data-panel-id");
                return;
            }

            const panel_body = document.querySelector(`#${panel_container_id} .panel_body`) as HTMLElement;

            if (panel_body.classList.contains('hide')) {
                project_panel_open();
            } else {
                project_panel_close();
            }
        });
        this.btn_project_panel_close.addEventListener('click', (evt) => {
            document.dispatchEvent(new CustomEvent("project-container-external-close", {
                detail: {
                    container: "editor-main",
                },
            }));

            this.notify_screen_left_reset();
        })

        this.btn_editor_options.addEventListener('click', () => {
            const after_open = () => {
                [this.btn_editor_save_code, this.btn_project_panel,
                    this.btn_compile].forEach(b => b.setAttribute("disabled", ""));
            }

            const after_close = () => {
                [this.btn_editor_save_code, this.btn_project_panel,
                    this.btn_compile].forEach(b => b.removeAttribute("disabled"));

                this.editor.focus();
            }
            UIContainers.panel_toggle(UIContainers.panel_options({initiator: this.btn_editor_options, after_open: after_open, after_close: after_close} as PanelOptions));
        });

        this.tabsize_select.addEventListener('change', (e) => this.handle_tabsize_change(e));

        this.btn_entry_call.addEventListener('click', () => {
            this.signature_container.classList.add('hide');
            this.entry_call_container.classList.remove('hide');
            this.arg_ro_message.classList.add('hide');

            this.btn_signature.classList.remove('hide');
            this.btn_entry_call.classList.add('hide');
        });

        this.btn_signature.addEventListener('click', () => {
            this.signature_container.classList.remove('hide');
            this.entry_call_container.classList.add('hide');

            if (this.xvm_param_parser.parameter_builder_data[this.program_entry_index].parameters.length === 0) {
                this.arg_ro_message.classList.remove('hide');
            } else {
                this.arg_ro_message.classList.add('hide');
            }

            this.btn_signature.classList.add('hide');
            this.btn_entry_call.classList.remove('hide');
        });

        this.btn_edit_params.addEventListener('click', () => this.ui_open_argument_editor());

        /* We update the readonly display whenever the parameter builder changes */
        document.addEventListener("pb-argument-did-change", () => {
            this.update_ro_argument_display();
        });

        document.addEventListener("screen-left-reset", () => {
            console.log("Argument editor reset - did screen-left-reset. restoring buttons");

            [this.btn_project_panel,
                this.btn_editor_save_code,
                this.btn_editor_options,
                this.btn_compile].forEach(b => b.removeAttribute("disabled"));

            this.editor.focus();
        });

        document.addEventListener("screen-right-reset", () => {
            console.log("Argument editor reset - did screen-right-reset.");
            UIContainers.panel_close(UIContainers.panel_options({initiator: this.btn_close_arg_editor} as PanelOptions));
        });

        /* Project Manager */
        this.project_manager = new ProjectManager();
        this.project_manager.buffer_needs_saving = () => {return this.editor_has_unsaved_changes};

        document.addEventListener("project-changed", (e) => {

            let current_project = this.project_manager.get_current_project();

            if(current_project === null) {
                console.error("current_project cannot be null.");
                return;
            }

            if(current_project?.last_used_file_metadata === null
                || current_project.last_used_file_metadata === undefined) {
                localStorage.setItem('last_file_used_data', "");
            }

            // Wait a for a second, then read the value?
            setTimeout(() => {
                _thisApp.project_manager.worker_last_file_used_poll.postMessage({command: "poll_with_current_project", cmd_opts: {project: current_project}});
            }, 250);

            this.update_info_display();
        });

        document.addEventListener("project-did-load-file", () => {
            console.log("Argument editor reset - did project-did-load-file.");
            this.notify_screen_left_reset();
        });

        document.addEventListener("file_loaded", (e) => {
            const ce = e as CustomEvent;
            const detail = ce.detail;
            console.log(`Loading ${detail.project.name}/${detail.filename}`);
            this.set_editor_code(detail.file_data);
        });

        /* end Project Manager */

        this.modal = new Modal();

        this.func_list = new FuncList(this);
        this.split_layout = new SplitLayout(this);
        this.func_list.load_funcs(this.silex);
        this.custom_select = new CustomSelect();
        this.modal_export = new ModalExport(this);

        const editor_element = document.getElementById('input_editor') as HTMLPreElement;
        this.editor = ace.edit(editor_element);
        this.editor.session.setMode("ace/mode/rust");
        this.editor.setTheme("ace/theme/tomorrow_night_bright");
        this.editor.setOptions({
            enableAutoIndent: true,
            wrapBehavioursEnabled: true // auto surround
        });

        this.editor.setHighlightActiveLine(false);
        this.editor.renderer.setPadding(8);
        this.editor.renderer.setScrollMargin(10, 10);

        const editor_session = this.editor.getSession();
        editor_session.on('change', (delta: ace.Ace.Delta) => {

            localStorage.setItem("code", editor_session.getValue());

            this.program_changed();
            this.update_info_display();
        });

        document.addEventListener("project-last-file-refresh", (e) => {
            this.update_info_display();
        });

        window.addEventListener('storage', (event) => {
            switch (event.key) {
                case 'code':
                break;
                case 'current_project':
                    const project = JSON.parse(event.newValue as string);
                    // reload all the projects
                    _thisApp.project_manager.load_projects_record();
                    _thisApp.project_manager.last_used_file_refresh();
                    // update the editor
                    _thisApp.set_editor_code(localStorage.getItem('code') ?? "");
                    break;
                default:
                    break;
            }
        });

        document.addEventListener("project-manager-loaded", (e) => {
            this.custom_select.build_selects();
        });

        _thisApp.call_history_init();
        _thisApp.reuse_entry_calls_init();
        this.load_save();

    }

    call_history_init() {
        const _thisApp = this;
        // get saved call history
        const saved_call_history = localStorage.getItem('call_history');
        if(saved_call_history !== null) {
            _thisApp.call_history = JSON.parse(saved_call_history);
        }

        if(_thisApp.prefs_CALL_HISTORY_MAX <= 0) {
            _thisApp.call_history = [];
        }

        if(_thisApp.prefs_CALL_HISTORY_MAX >= 0 && _thisApp.call_history.length > _thisApp.prefs_CALL_HISTORY_MAX) {
            _thisApp.call_history.splice(0, _thisApp.call_history.length - _thisApp.prefs_CALL_HISTORY_MAX);
        }

        localStorage.setItem('call_history', JSON.stringify(_thisApp.call_history));
    }

    reuse_entry_calls_init() {
        const _thisApp = this;
        // get saved call history
        const reuse_last_call = localStorage.getItem('reuse_entry_calls');
        if(reuse_last_call !== null) {
            _thisApp.prefs_REUSE_ENTRY_CALLS = JSON.parse(reuse_last_call);
        }

        if(_thisApp.prefs_REUSE_ENTRY_CALLS) {
            _thisApp.prefs_REUSE_ENTRY_CALLS = true;
            _thisApp.btn_reuse_entry_calls.setAttribute("data-tooltip", "Disable call reuse");
            _thisApp.btn_reuse_entry_calls.setAttribute("data-toggle", "on");
        } else {
            _thisApp.prefs_REUSE_ENTRY_CALLS = false;
            _thisApp.btn_reuse_entry_calls.setAttribute("data-tooltip", "Enable call reuse");
            _thisApp.btn_reuse_entry_calls.setAttribute("data-toggle", "off");
        }

        localStorage.setItem('reuse_entry_calls', JSON.stringify(_thisApp.prefs_REUSE_ENTRY_CALLS));
    }


    update_info_display() {
        const _thisApp = this;

        const current_project_name = document.getElementById("current-project") as HTMLElement;
        current_project_name.textContent = _thisApp.project_manager.get_current_project()?.name as string;

        const last_file_used_name = _thisApp.project_manager.get_current_project()?.last_used_file_metadata?.name ?? "-";

        const editor_buffer_info = document.getElementById("editor-buffer-info") as HTMLElement;
        const last_file_used_data = localStorage.getItem('last_file_used_data') ?? "";
        if(_thisApp.editor.getValue() === last_file_used_data) {
            _thisApp.editor_has_unsaved_changes = false;
            editor_buffer_info.classList.remove('unsaved');
            editor_buffer_info.textContent = last_file_used_name;
        } else {
            _thisApp.editor_has_unsaved_changes = true;
            editor_buffer_info.classList.add('unsaved');
            editor_buffer_info.textContent = "- unsaved -";
        }

        const current_file_info = document.getElementById("current-file") as HTMLElement;

        if(this.project_manager.get_current_project()?.last_used_file_metadata !== null) {
            current_file_info.textContent = last_file_used_name;
        } else {
            current_file_info.textContent = "-";
        }
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
        this.editor.setOption("tabSize", parseInt(tabsize));
    }

    set_editor_code(code: string) {
        this.editor.setValue(code, -1); // -1 places the cursor at the top -- undefined or 0 select all text
        this.program_changed();
    }

    program_changed() {
        if (this.program_code && this.program_code !== this.editor.getValue()) {
            this.btn_run.setAttribute("disabled", "");
            this.btn_export.setAttribute("disabled", "");
            this.output.innerHTML = "";

            this.clear_program();
            this.program_code = "";
            this.program_entry_index = 0;
        }
    }

    compile_save_code() {
        localStorage.setItem('code', this.editor.getValue());
    }

    clear_program() {
        this.xvm_param_parser = new XVMParamParser();
        this.entry_call_container.replaceChildren();
        this.entry_menu.replaceChildren();

        // UI
        const e_name_ro = document.querySelector(`#hud-entry-name`) as HTMLElement;
        e_name_ro.innerHTML = `&nbsp;`;

        // entry call window
        this.btn_entry_call.click();

        this.btn_run.setAttribute('disabled', '');
        this.btn_export.setAttribute("disabled", "");
        this.btn_reuse_entry_calls.setAttribute('disabled', '');
        this.btn_call_history.setAttribute('disabled', '');
        this.btn_edit_params.setAttribute('disabled', '');
        this.btn_entry_call.setAttribute('disabled', '');
        this.btn_signature.setAttribute('disabled', '');
        this.btn_copy.setAttribute('disabled', '');

    }

    add_entry(entry: any, index: number) {
        const _thisApp = this;

        const link = document.createElement(`a`);
        link.classList.add(`entry-link`);
        link.setAttribute(`data-entry-index`, `${index}`);
        link.textContent = entry.name();
        this.entry_menu.appendChild(link);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            /* defaults */
            this.arg_ro_message.classList.add('hide');
            /* end defaults */
            this.program_entry_index = index;

            const params = this.xvm_param_parser.parameter_builder_data[this.program_entry_index].parameters;

            if (params.length > 0) {
                this.btn_edit_params.removeAttribute('disabled');
            } else {
                this.btn_edit_params.setAttribute('disabled', '');
            }

            const entry_name = this.xvm_param_parser.parameter_builder_data[this.program_entry_index].name;
            const e_name_ro = document.querySelector(`#hud-entry-name`) as HTMLElement;
            e_name_ro.textContent = `${entry_name}`;

            this.signature_container.replaceChildren();

            params.forEach((param, index) => {
                const p_elem = document.createElement("parameter");
                const label = document.createElement("label");
                const sig = document.createElement("signature");

                label.textContent = `${param.name}: `;
                sig.textContent = `${param.signature}`;
                p_elem.appendChild(label);
                p_elem.appendChild(sig);
                this.signature_container.appendChild(p_elem);
            });

            this.entry_menu.style.display = 'none';
            this.entry_menu.classList.remove('dropdown-content');

            setTimeout(() => {
                this.entry_menu.style.display = '';
                this.entry_menu.classList.add('dropdown-content');
            }, 500);

            // reuse call history
            if(_thisApp.prefs_REUSE_ENTRY_CALLS && _thisApp.call_history.length > 0) {

                let ch_match = false;

                for(let i = _thisApp.call_history.length - 1; i >= 0; --i) {
                    let current_call_history_params: Record<string, string> = _thisApp.call_history[i];
                    const param_containers = document.querySelectorAll(`#pb_entry_container_${this.program_entry_index} > .pb-input-scrollbox > .pb-input-container > .param-container`) as NodeListOf<HTMLElement>;
                    const lechp_keys = Object.keys(current_call_history_params);

                    if(Object.keys(lechp_keys).length === params.length
                        && param_containers.length === params.length) {

                        // TODO allow unsigned int parameters to change (u.includes(lechp_keys[j]))
                        // let unsigned_ints = ["u8", "u16", "u32", "u64", "u128", "u256", "u512"];
                        // check if the corresponding param keys match the current entry call history params.
                        let match_found = true;
                        for(let j = 0; j < params.length; j++) {
                            if(lechp_keys[j] !== params[j].signature.toLowerCase()) {
                                match_found = false;
                                break;
                            }
                        }

                        if(match_found) {
                            ch_match = true;
                            for(let j = 0; j < params.length; j++) {
                                //console.log(`lechp_keys[${j}] = ${lechp_keys[j]} params sig: ${params[j].signature} `);
                                if(lechp_keys[j] === params[j].signature.toLowerCase()) {
                                    const param_container = param_containers[j];
                                    switch(lechp_keys[j]) {
                                        case "u8":
                                        case "u16":
                                        case "u32":
                                        case "u64":
                                        case "u128":
                                        case "u256":
                                        case "u512":
                                        case "string":
                                        {
                                            const p_input = param_container.querySelector(`.input-container[data-type="${lechp_keys[j]}"] input`) as HTMLInputElement;
                                            p_input.value = current_call_history_params[lechp_keys[j]];
                                            p_input.dispatchEvent(new Event('change'));
                                            break;
                                        }

                                        case "address":
                                        case "hash": {
                                            const p_input = param_container.querySelector(`.type-container > textarea`) as HTMLInputElement;
                                            p_input.value = current_call_history_params[lechp_keys[j]];
                                            p_input.dispatchEvent(new Event('change'));
                                            break;
                                        }

                                        default:
                                            console.error(`Complex type ${lechp_keys[j]}. TODO.`);
                                            break;

                                    }
                                }
                            }
                        }

                    }

                    if(ch_match) {
                        break;
                    }
                }


                // for(let i = _thisApp.call_history.length - 1; i >= 0; --i) {
                //     let current_call_history_params: Record<string, string> = _thisApp.call_history[_thisApp.call_history.length - 1];
                //     const param_containers = document.querySelectorAll(`#pb_entry_container_${this.program_entry_index} > .pb-input-scrollbox > .pb-input-container > .param-container`) as NodeListOf<HTMLElement>;
                //     const lechp_keys = Object.keys(current_call_history_params);
                //
                //     // check if the corresponding param keys match the current entry call history params.
                //     for(let j = 0; j < params.length; j++) {
                //
                //     }
                //
                //     if(Object.keys(lechp_keys).length === params.length
                //         && param_containers.length === params.length) {
                //
                //     }
                // }

                // console.log("LINK - INVOKE - last_entry_call_history_params");
                // console.log(last_entry_call_history_params);
                // console.log(params);


            }


            this.update_ro_argument_display();
        });
    }

    update_ro_argument_display() {
        if (this.entry_call_container !== null) {
            this.entry_call_container.replaceChildren();
            const e_name = this.xvm_param_parser.parameter_builder_data[this.program_entry_index].name;
            const func_name = document.createElement(`entry-name`);
            func_name.classList.add(`code`);
            func_name.textContent = `${e_name}(`;
            this.entry_call_container.appendChild(func_name);
            const pba_container = document.querySelector(`#pb_entry_container_${this.program_entry_index} > div.pb-arguments-container`) as HTMLElement;
            if (pba_container.hasChildNodes()) {
                for (const node of pba_container.childNodes) {
                    this.entry_call_container.appendChild(node.cloneNode(true));
                }
            }
            const close_func_name = document.createElement(`entry-name`);
            close_func_name.classList.add(`code`);
            close_func_name.textContent = `)`;
            this.entry_call_container.appendChild(close_func_name);
        }
    }

    output_error(text: string, append: boolean = false) {
        return `<span class="out-err">${text}</span>`;
    }

    output_success(text: string, append: boolean = false) {
        return `<span class="out-success">${text}</span>`;
    }

    compile_code() {
        try {
            this.compile_save_code();
            this.clear_program();
            // if we were using the argument editor, reset to contract/program panel.
            this.notify_screen_right_reset();
            this.output.innerHTML = "Program saved locally.\n";
            const code = this.editor.getValue();
            localStorage.setItem('code', code);

            this.output.textContent += "------- Compiling -------\n";
            const program = this.silex.compile(code);

            const entries = program.entries();
            entries.forEach((entry: any, index: number) => {
                this.xvm_param_parser.make_schema_from_entry(entry);
                this.add_entry(entry, index);

                let pb_entry_container = document.getElementById(`pb_entry_container_${index}`);;
                let pb_input_scrollbox: HTMLElement;
                let pb_footer_container: HTMLElement;
                let pb_input_container: HTMLElement;
                let arg_container: HTMLElement;

                if (pb_entry_container !== null) {
                    pb_input_container = pb_entry_container.querySelector(`div.pb-input-container`) as HTMLElement;
                    arg_container = pb_entry_container.querySelector(`div.pb-arguments-container`) as HTMLElement;
                } else {
                    pb_entry_container = document.createElement(`div`);
                    pb_entry_container.id = `pb_entry_container_${index}`;
                    pb_entry_container.classList.add(`pb_entry_container`);

                    pb_input_scrollbox = document.createElement(`div`);
                    pb_input_scrollbox.classList.add(`pb-input-scrollbox`);

                    pb_input_container = document.createElement(`div`);
                    pb_input_container.classList.add(`pb-input-container`);

                    arg_container = document.createElement(`div`);
                    arg_container.classList.add(`pb-arguments-container`);

                    pb_footer_container = document.createElement(`div`);
                    pb_footer_container.classList.add(`pb-footer-container`);
                    pb_footer_container.innerHTML = `<div class="pb-footer-buttons"></div>`


                    pb_entry_container.appendChild(arg_container);
                    pb_input_scrollbox.appendChild(pb_input_container);
                    pb_entry_container.appendChild(pb_input_scrollbox);
                    pb_entry_container.appendChild(pb_footer_container);

                    this.pb_main_container.appendChild(pb_entry_container);
                }

                pb_entry_container.setAttribute('data-pbe-index', `${index}`);

                const parsed_entry = this.xvm_param_parser.parameter_builder_data[index];
                ParameterBuilder.build_from_schema(parsed_entry.parameters, {
                    arg_container: arg_container,
                    pb_container: pb_input_container
                });
            });

            if (entries.length === 0) {
                this.btn_run.setAttribute('disabled', '');
            } else {
                this.btn_run.removeAttribute('disabled');
                const first_menu_link = document.querySelector(`#entry-menu a`) as HTMLLinkElement;
                first_menu_link.click();
            }

            this.program_code = code;
            this.output.innerHTML += this.output_success("Compiled successfully!\n");

            this.btn_reuse_entry_calls.removeAttribute('disabled');
            //this.btn_call_history.removeAttribute('disabled');
            this.btn_export.removeAttribute('disabled');
            this.btn_entry_call.removeAttribute('disabled');
            this.btn_entry_call.classList.add('selected');
            this.btn_signature.removeAttribute('disabled');
            this.btn_copy.removeAttribute('disabled');
        } catch (e) {
            this.output.innerHTML += this.output_error("Error: " + e + "\n");
        }
    }

    get_program_params() {
        const params = [] as string[];
        const call_hist_params: Record<string, string> = {};


        const pbe_params_elems = document.querySelectorAll(`#pb_entry_container_${this.program_entry_index} > div.pb-arguments-container > pre`);
        pbe_params_elems.forEach((pbe, index) => {
            // remove the quotes
            const copy_pbe = pbe.cloneNode(true) as HTMLElement;
            const type_name = copy_pbe.firstChild?.nodeName.toLowerCase() ?? "unknown_type";
            let ch_type_name = type_name;

            let content: string | null | undefined;
            const call_hist_params_content = {} as Record<string, string>;

            ['quote'].forEach(c => {
                const brace_children = copy_pbe.querySelectorAll(c);
                for (const b of brace_children) {
                    b.remove();
                }
            });

            // TODO: Verify that the opaque type format will be specialized.
            switch (type_name) {
                case 'opaque':
                    // address tag, hash tag, etc.
                    const opaque_type = copy_pbe.firstChild?.firstChild?.firstChild;
                    console.log(opaque_type);
                    //const ot_name = opaque_type?.nodeName.toLowerCase();
                    //content =`{type: "${ot_name}", value: ${opaque_type?.textContent}}`
                    content = opaque_type?.textContent;

                    if(opaque_type !== null && opaque_type !== undefined) {
                        ch_type_name = opaque_type?.nodeName.toLowerCase();
                    }
                    break;

                default:
                    content = copy_pbe.textContent;
                    break;
            }

            params.push(`${content}`);
            call_hist_params[ch_type_name] = `${content}`;
        });

        console.log("GET_PARAMS OUTPUT");
        console.log(params);

        this.call_history_add(call_hist_params);

        return params;
    }

    btn_run_set_running() {
        this.btn_run.textContent = "Running";
        this.btn_run.setAttribute(`disabled`, "");
    }

    btn_run_set_run() {
        this.btn_run.textContent = "Run";
        this.btn_run.removeAttribute(`disabled`);
    }

    async run_program() {
        let max_gas = null as bigint | null; // infinite
        this.output.innerHTML = "";

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

            this.output.textContent = "";
            let logs = result.logs();
            if (logs.length > 0) {
                this.output.textContent += logs.join("\n");
                this.output.textContent += "\n";
            }

            this.output.textContent += `-------- Result --------\n`;
            this.output.textContent += `Exit code: ${result.value()}\n`;
            this.output.textContent += `Executed in: ${result.elapsed_time()}\n`;
            this.output.textContent += `Gas usage: ${result.used_gas()} (${result.used_gas_formatted()} XEL)\n`;
            this.output.textContent += `Memory usage: ${result.used_memory()} (${result.used_memory_formatted()})\n`;

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
        this.program_changed();
    }

    open_modal_export() {
        this.modal.open(this.modal_export.element);
    }

    get_program() {
        return this.silex.compile(this.program_code);
    }

    replace_spaces_indentation(data: string) {
        return data.replace(/^( +)/gm, (match) => {
            const tab_count = Math.floor(match.length / 4);
            return `\t`.repeat(tab_count);
        });
    }

    /** Opens the parameter builder modal.
     * TODO: Best to move this into the program window, and get rid of the modal.
     * */
    ui_open_argument_editor() {
        const arg_editor = UIContainers.panel_open(UIContainers.panel_options({initiator: this.btn_edit_params} as PanelOptions))

        if(arg_editor === null) {
            console.log("Error opening argument editor");
        }

        for (const pbe of this.pb_main_container.children) {
            if (parseInt(pbe.getAttribute("data-pbe-index") || "") === this.program_entry_index) {
                const entry_stat = document.querySelector(`#pb-ui-entry-stat`);
                if (entry_stat !== null) {
                    entry_stat.textContent = `${this.xvm_param_parser.parameter_builder_data[this.program_entry_index].name}`;
                }

                const param_stat = document.querySelector(`#pb-ui-params-stat`);
                if (param_stat !== null) {
                    param_stat.textContent = `${this.xvm_param_parser.parameter_builder_data[this.program_entry_index].parameters.length}`;
                }

                pbe.classList.remove('hide');
            } else {
                pbe.classList.add('hide');
            }
        }
    }

    output_panel_toggle(should_shrink: boolean | undefined) {

        const btn_output_panel_expand = document.querySelector(`#btn_output_panel_expand`) as HTMLButtonElement;
        const btn_output_panel_shrink = document.querySelector(`#btn_output_panel_shrink`) as HTMLButtonElement;
        const gas_limit_display = document.querySelector(`#gas_limit_display`) as HTMLElement;

        if(this.output_panel_expanded) {
            console.log("Shrink output window");
            btn_output_panel_expand.classList.remove('hide');
            btn_output_panel_shrink.classList.add('hide');
            this.parameter_display.classList.remove('hide');
            gas_limit_display.classList.remove('hide');
            this.output_panel_expanded = false;
        } else {
            console.log("Expand output window");

            btn_output_panel_expand.classList.add('hide');
            btn_output_panel_shrink.classList.remove('hide');
            this.parameter_display.classList.add('hide');
            gas_limit_display.classList.add('hide');
            this.output_panel_expanded = true;
        }
    }

    /* should be in a utilities file */
    async copy_text_to_clipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            console.log('Text successfully copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }

    notify_screen_left_reset() {
        const screen_left_reset = new CustomEvent("screen-left-reset", {
            detail: {},
        });

        document.dispatchEvent(screen_left_reset);
    }

    notify_screen_right_reset() {
        const screen_right_reset = new CustomEvent("screen-right-reset", {
            detail: {},
        });

        document.dispatchEvent(screen_right_reset);
    }

    private call_history_add(params: Record<string, string>) {
        const _thisApp = this;

        // if there are no history entries, we should add the first entry.
        // If there are entries, we should check if the call history has an exact copy
        // of the current entry and remove it.
        let should_add = this.call_history.length === 0;

        if(!should_add) {  // confirm it shouldn't be added or remove a copy'

            let found_match = false;

            for(let i = _thisApp.call_history.length - 1; i >= 0; --i) {
                let call_hist_entry: Record<string, string> = _thisApp.call_history[i];

                if(Object.keys(call_hist_entry).length === Object.keys(params).length) {
                    const le_keys = Object.keys(call_hist_entry);
                    const pe_keys = Object.keys(params);

                    let local_match = true;

                    for(let j = 0; j < le_keys.length; j++) {
                        if(le_keys[j] !== pe_keys[j]) {
                            local_match = false
                            break;
                        }

                        if(call_hist_entry[le_keys[j]] !== params[le_keys[j]]) {
                            local_match = false
                            break;
                        }
                    }

                    if(local_match) {
                        found_match = true;
                        if(i === _thisApp.call_history.length - 1) {
                            console.log("DEBUG --- latest entry in the call history is a copy of the current entry.");
                            break;
                        } else {
                            // splice out the entry
                            _thisApp.call_history.splice(i, 1);
                            should_add = true;   // bubble to the top of the list.
                            break;
                        }
                    }
                }

                if(found_match) {
                    break;
                }
            }

            if(!found_match) {
                should_add = true;
            }
        }

        if (should_add) {
            if(_thisApp.call_history.length >= _thisApp.prefs_CALL_HISTORY_MAX) {
                _thisApp.call_history.shift();
            }
            _thisApp.call_history.push(params);

            localStorage.setItem('call_history', JSON.stringify(_thisApp.call_history));
        }

        //console.log(_thisApp.call_history);
    }
}
