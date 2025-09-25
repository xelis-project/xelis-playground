import {PanelOptions, UIContainers} from "./UIContainers";
import {UUID, uuidv7} from "uuidv7";
import EditIcon from "./resources/icons/edit-icon.svg";
import {Utils} from "./Utils";
import DeleteIcon from "./resources/icons/trash-icon.svg";
import ExportIcon from "./resources/icons/export-icon.svg";
import {FileMetaData, PMConfig, Project} from "./project";
import { createElement } from "ace-builds-internal/lib/dom";

type MapUUID = string;
type StoragePresetRecord = Record<MapUUID, StoragePreset>;
type StoragePresetMapRecord = Record<MapUUID, StoragePresetMap>;

type SilexTypeIDS = Record<string, number>;

const SILEX_TYPE_IDS: SilexTypeIDS = {
    "u8" : 0,
    "u16" : 1,
    "u32" : 2,
    "u64" : 3,
    "u128" : 4,
    "u256" : 5,
    "bool" : 6,
    "string" : 7,
}

function get_type_name_with_id(key_type_id: number) : string {
    let key_name = Object.keys(SILEX_TYPE_IDS).find(key => SILEX_TYPE_IDS[key] === key_type_id);
    if(key_name === undefined) {
        key_name = "unknown";
    }
    return key_name;
}

function silex_type_menu() {

    const dropdow_menu = document.createElement(`div`);
    dropdow_menu.classList.add(`dropdown`);

    const menu_stat_ro = document.createElement(`div`);
    menu_stat_ro.classList.add(`menu-stat-ro`);
    const menu_selection = document.createElement(`span`);
    menu_selection.classList.add(`menu-item-name`);
    menu_selection.textContent = "u8";

    const dropdown_content = document.createElement(`div`);
    dropdown_content.classList.add(`dropdown-content`);


    Object.keys(SILEX_TYPE_IDS).forEach(typename => {
        const link = document.createElement(`a`);
        link.classList.add(`type-link`);
        link.textContent = typename.toString();
        dropdown_content.appendChild(link);
    });

    dropdown_content.addEventListener("click", (e) => {
        menu_selection.textContent = (e.target as HTMLElement).textContent;
        close_menu(dropdown_content);
    });

    menu_stat_ro.appendChild(menu_selection);
    menu_stat_ro.appendChild(dropdown_content);
    dropdow_menu.appendChild(menu_stat_ro);

    return dropdow_menu;
}

function close_menu(menu_content: HTMLElement) {
    menu_content.style.display = 'none';
    menu_content.classList.remove('dropdown-content');

    setTimeout(() => {
        menu_content.style.display = '';
        menu_content.classList.add('dropdown-content');
    }, 500);
}


const DEFAULT_STRING = "";

function truncateString(str: string, maxLength: number) {
    if (str.length > maxLength) {
        // Subtract 3 from maxLength to account for the "..."
        return str.slice(0, maxLength - 3) + '...';
    }
    return str;
}
export class StoragePreset {
    key_type_id: number = 0;
    key: string = "";
    value_type_id: number = 0;
    value: string = "";
}

export class StoragePresetMap {
    map_uuid: MapUUID = uuidv7();
    name: string;
    description: string;
    presets: StoragePresetRecord = {};

    constructor(name: string, description: string = "") {
        this.name = name;
        this.description = description;
    }
}

export class StorageEditor {
    version = 1;
    private static _storage_editor: StorageEditor;
    storage_preset_maps: StoragePresetMapRecord = {};
    enable_storage_presets = true;
    private readonly btn_close_storage_editor: HTMLElement;

    private hud_storage_menu_selected: HTMLElement;
    private hud_storage_menu_content: HTMLElement;
    private storage_editor_menu_selected: HTMLElement;
    private storage_editor_menu_content: HTMLElement;
    private sme_new_dialog: HTMLElement;
    private sme_insert_update_dialog: HTMLElement;
    private sp_table_container: HTMLElement;

    private sm_input_name: HTMLInputElement;
    private sm_input_description: HTMLInputElement;
    private btn_sm_cancel_new: HTMLElement;
    private btn_sm_create_new: HTMLElement;

    private btn_delete_storage_map: HTMLElement;

    private map_name_input: HTMLInputElement;
    private map_desc_input: HTMLInputElement;
    private btn_update: HTMLElement;

    current_storage_map_uuid: MapUUID  = DEFAULT_STRING;

    private constructor() {
        this.btn_close_storage_editor = document.getElementById('btn_close_storage_editor') as HTMLElement;

        this.hud_storage_menu_selected = document.getElementById('hud-storage-preset-map-selected') as HTMLElement;
        this.hud_storage_menu_content = document.getElementById('hud-storage-preset-map-menu-content') as HTMLElement;
        this.storage_editor_menu_selected = document.getElementById('storage-editor-menu-selected') as HTMLElement;
        this.storage_editor_menu_content = document.getElementById('storage-editor-menu-content') as HTMLElement;
        this.sme_new_dialog = document.getElementById('storage-map-new-dialog') as HTMLElement;
        this.sme_insert_update_dialog = document.getElementById('storage-map-insert-update-dialog') as HTMLElement;

        this.btn_sm_create_new = document.getElementById('sm-create-new') as HTMLElement;
        this.btn_sm_cancel_new = document.getElementById('sm-cancel-new') as HTMLElement;
        this.btn_delete_storage_map = document.getElementById('btn_delete_storage_map') as HTMLElement;
        this.sm_input_name = document.getElementById('sm-input-name') as HTMLInputElement;
        this.sm_input_description = document.getElementById('sm-input-description') as HTMLInputElement;

        this.btn_update = document.querySelector(`#btn_update_storage_map`) as HTMLElement;

        this.sp_table_container = document.createElement('div');
        this.sp_table_container.id = 'sp-content-dtc';
        this.sp_table_container.classList.add("sp-content-dtc");
        this.sp_table_container.style.display = 'none';

        // add none and edit options. could have been done in the html but this is easier.
        const hud_link_none = document.createElement(`a`);
        hud_link_none.classList.add(`storage-map-link`);
        hud_link_none.setAttribute(`data-entry-sm-uuid`, `none`);
        hud_link_none.textContent = 'None';
        this.hud_storage_menu_content.appendChild(hud_link_none);

        const hud_link_edit = document.createElement(`a`);
        hud_link_edit.classList.add(`storage-map-link`);
        hud_link_edit.setAttribute(`data-entry-sm-uuid`, `edit`);
        hud_link_edit.textContent = "Map Editor ...";
        this.hud_storage_menu_content.appendChild(hud_link_edit);

        const hud_spm_items_container = document.createElement(`div`);
        hud_spm_items_container.id = `hud-spm-items`;
        this.hud_storage_menu_content.appendChild(hud_spm_items_container);


        function make_link(name: string, uuid: MapUUID = DEFAULT_STRING) {
            const link = document.createElement(`a`);
            link.classList.add(`storage-map-link`);
            link.setAttribute(`data-entry-sm-uuid`, uuid);
            link.textContent = name;
            return link;
        }

        // const storage_link_edit = make_link(`Edit`);
        // this.storage_editor_menu_content.appendChild(storage_link_edit);
        //

         const storage_link_none = make_link(`None`);
         this.storage_editor_menu_content.appendChild(storage_link_none);

        const storage_link_new = make_link(`New Map ...`);
        this.storage_editor_menu_content.appendChild(storage_link_new);

        const storage_spm_items_container = document.createElement(`div`);
        storage_spm_items_container.id = `storage-spm-items`;
        this.storage_editor_menu_content.appendChild(storage_spm_items_container);

        this.map_name_input = document.querySelector(`#sm-info-name`) as HTMLInputElement;
        this.map_desc_input = document.querySelector(`#sm-info-description`) as HTMLInputElement;

        [this.map_name_input, this.map_desc_input].forEach(input => {
            input.addEventListener("input", e => {
                if(this.map_name_input.value.length !== 0
                    && (this.map_name_input.value + this.map_desc_input.value) !== (this.storage_preset_maps[this.current_storage_map_uuid].name + this.storage_preset_maps[this.current_storage_map_uuid].description)
                ) {
                    this.btn_update.removeAttribute("disabled");
                } else {
                    this.btn_update.setAttribute("disabled", "");
                }
            });
        });

        this.btn_update.addEventListener("click", e => {
            let storage_map = this.storage_preset_maps[this.current_storage_map_uuid];

            storage_map.name = this.map_name_input.value;
            storage_map.description = this.map_desc_input.value;
            this.btn_update.setAttribute("disabled", "");

            const links = document.querySelectorAll(`a[data-entry-sm-uuid="${this.current_storage_map_uuid}"]`);

            links.forEach(link => {
                link.textContent = storage_map.name;
            });

            this.hud_storage_menu_selected.textContent = truncateString(storage_map.name, 15);
            this.storage_editor_menu_selected.textContent = truncateString(storage_map.name, 15);

            localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));
        });

        // new storage map
        [this.sm_input_name, this.sm_input_description].forEach(input => {
            input.addEventListener("input", e => {
                if(this.sm_input_name.value.length !== 0) {
                    this.btn_sm_create_new.removeAttribute("disabled");
                } else {
                    this.btn_sm_create_new.setAttribute("disabled", "");
                }
            });
        });

        [hud_link_none, storage_link_none].forEach(link => {
            link.addEventListener("click", e => {
                this.current_storage_map_uuid = DEFAULT_STRING;
                localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));

                this.hud_storage_menu_selected.textContent = "None";
                this.storage_editor_menu_selected.textContent = "None";

                this.toggle_storage_editor_inputs();
                // remove table body data
                const data_table_body = document.querySelector(`#storage-map-data-table-body`) as HTMLElement;
                data_table_body.replaceChildren();

                if(link === storage_link_none) {
                    close_menu(this.storage_editor_menu_content);
                    // because it could be selected in new map mode.
                    this.ui_open_storage_editor();
                } else {
                    close_menu(this.hud_storage_menu_content);
                }
            });
        });


        hud_link_edit.addEventListener("click", () => {
            close_menu(this.hud_storage_menu_content);
            StorageEditor._storage_editor.ui_open_storage_editor();
        });

        storage_link_new.addEventListener("click", () => {
            close_menu(this.storage_editor_menu_content);
            this.ui_open_storage_editor(true);
        });

        this.btn_sm_create_new.addEventListener("click", () => {
            if(this.sm_input_name.value.length === 0) {
                console.log("Error: no storage preset name provided");
                return;
            }

            let storage_peset_map = new StoragePresetMap(this.sm_input_name.value, this.sm_input_description.value);
            this.storage_preset_maps[storage_peset_map.map_uuid] = storage_peset_map;
            this.current_storage_map_uuid = storage_peset_map.map_uuid;
            this.hud_storage_menu_selected.textContent = truncateString(storage_peset_map.name, 15);
            this.storage_editor_menu_selected.textContent = truncateString(storage_peset_map.name, 15);

            this.sme_new_dialog.style.display = 'none';
            this.sme_insert_update_dialog.style.display = 'block';
            this.sp_table_container.style.display = 'flex';

            this.sm_input_name.value = "";
            this.sm_input_description.value = "";
            this.btn_sm_create_new.setAttribute("disabled", "");
            this.ui_open_storage_editor();

            this.ui_render_spm_data_for_map(this.current_storage_map_uuid);

            localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));

        });

        this.btn_sm_cancel_new.addEventListener("click", () => {
            this.sme_new_dialog.style.display = 'none';
            this.sme_insert_update_dialog.style.display = 'block';
            this.sp_table_container.style.display = 'flex';

            this.sm_input_name.value = "";
            this.sm_input_description.value = "";
            this.btn_sm_create_new.setAttribute("disabled", "");
        });

        this.btn_delete_storage_map.addEventListener("click", () => {
            if(this.current_storage_map_uuid === DEFAULT_STRING) {
                console.log("Error: no storage map selected");
                return;
            }

            delete this.storage_preset_maps[this.current_storage_map_uuid];

            this.current_storage_map_uuid = DEFAULT_STRING;
            this.hud_storage_menu_selected.textContent = "None";
            this.storage_editor_menu_selected.textContent = "None";
            this.map_name_input.value = "";
            this.map_desc_input.value = "";

            // remove table body data
            const data_table_body = document.querySelector(`#storage-map-data-table-body`) as HTMLElement;
            data_table_body.replaceChildren();

            this.ui_render_sp_menus();

            localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));

            this.btn_close_storage_editor.dispatchEvent(new Event("click"));

        })
    }

    static default() {
        if(StorageEditor._storage_editor !== undefined) {
            return StorageEditor._storage_editor;
        }

        StorageEditor._storage_editor = new StorageEditor();

        let storage_editor_data = localStorage.getItem("storage_editor");
        if(storage_editor_data !== null) {
            let se = JSON.parse(storage_editor_data) as StorageEditor;

            StorageEditor._storage_editor.storage_preset_maps = se.storage_preset_maps;
            StorageEditor._storage_editor.enable_storage_presets = se.enable_storage_presets;
            StorageEditor._storage_editor.current_storage_map_uuid = se.current_storage_map_uuid;

        }

        StorageEditor._storage_editor.render_storage_editor_inputs();
        StorageEditor._storage_editor.ui_render_sp_menus();
        StorageEditor._storage_editor.toggle_storage_editor_inputs();
        return StorageEditor._storage_editor;
    }

    public btn_close() {
        return this.btn_close_storage_editor;
    }

    // returns the currently select preset map if enabled.
    public get_storage_presets_with_map_id(uuid: string) {
        if(uuid === DEFAULT_STRING) {
            return [];
        }

        let presets = Object.values(this.storage_preset_maps[uuid].presets);
        console.log("------------------------   presets:  ------------------------");
        console.log(presets);
        return this.enable_storage_presets ? presets : [];
    }

    private ui_open_storage_editor(new_mode: boolean = false) {
        const storage_editor = UIContainers.panel_open(UIContainers.panel_options({data_panel_id: `storage_preset_container`} as PanelOptions))

        if(storage_editor === null) {
            console.log("Error opening storage editor");
            return
        }

        this.ui_render_sp_menus();

        // condition to open on new or edit.
        if(new_mode) {
            this.sme_new_dialog.style.display = 'block';
            this.sme_insert_update_dialog.style.display = 'none';
            this.sp_table_container.style.display = 'none';
        } else {
            this.sme_new_dialog.style.display = 'none';
            this.sme_insert_update_dialog.style.display = 'block';
            this.sp_table_container.style.display = 'flex';
        }


        this.ui_render_spm_data_for_map(this.current_storage_map_uuid);

    }

    private ui_render_sp_menus() {
        const _thisSE = this;

        function make_spm_link(map_uuid: MapUUID, sp_map: StoragePresetMap) {
            const link = document.createElement(`a`);
            link.classList.add(`storage-map-link`);
            link.setAttribute(`data-entry-sm-uuid`, `${map_uuid}`);
            link.textContent = sp_map.name;
            return link;
        }

        const hud_spm_items_container = _thisSE.hud_storage_menu_content.querySelector(`#hud-spm-items`) as HTMLElement;
        hud_spm_items_container.replaceChildren();

        const storage_spm_items_container = _thisSE.storage_editor_menu_content.querySelector(`#storage-spm-items`) as HTMLElement;
        storage_spm_items_container.replaceChildren();

        if(Object.values(_thisSE.storage_preset_maps).length > 0) {
            const menu_separator = document.createElement("hr");
            menu_separator.classList.add("menu-separator");
            hud_spm_items_container.appendChild(menu_separator);
            storage_spm_items_container.appendChild(menu_separator.cloneNode(true));

            if(this.current_storage_map_uuid !== DEFAULT_STRING) {
                let sm = _thisSE.storage_preset_maps[_thisSE.current_storage_map_uuid];
                _thisSE.hud_storage_menu_selected.textContent = truncateString(sm.name, 15);
                //this.hud_storage_menu_selected.classList.add("selected");
                _thisSE.storage_editor_menu_selected.textContent = truncateString(sm.name, 15);

            } else {
                _thisSE.hud_storage_menu_selected.textContent = "None";
            }

            Object.entries(_thisSE.storage_preset_maps).forEach(([map_uuid, sp_map]) => {
                const hud_link = make_spm_link(map_uuid, sp_map);
                const storage_editor_link = hud_link.cloneNode(true) as HTMLElement;

                let link_objects: HTMLElement[][] = [[hud_link, this.hud_storage_menu_content ], [storage_editor_link, this.storage_editor_menu_content]];

                link_objects.forEach(([link, menu_content]) => {
                    link.addEventListener("click", () => {
                        _thisSE.current_storage_map_uuid = map_uuid;
                        localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));
                        _thisSE.hud_storage_menu_selected.textContent = truncateString(sp_map.name, 15);
                        _thisSE.storage_editor_menu_selected.textContent = truncateString(sp_map.name, 15);

                        close_menu(menu_content);
                        this.ui_render_spm_data_for_map(map_uuid);
                    });
                });

                hud_spm_items_container.appendChild(hud_link);
                storage_spm_items_container.appendChild(storage_editor_link);
            });

            this.storage_editor_menu_selected.textContent = this.hud_storage_menu_selected.textContent;

        } else {
            this.hud_storage_menu_selected.textContent = "None";
            this.storage_editor_menu_selected.textContent = "None";
            this.current_storage_map_uuid = DEFAULT_STRING;
            // clear table
        }
    }

    private render_storage_editor_inputs() {
        const sp_content_container = UIContainers.get_panel_selection_container(`#storage_preset_container`) as HTMLElement;

        if(sp_content_container === null) {
            console.log("Error opening storage editor content container");
            return;
        }

        const data_table_container = document.createElement('div');
        data_table_container.classList.add("data-table-container", "scrollable");

        let data_table = document.createElement("table");
        data_table.classList.add("data-table", "storage-map-data");

        const dt_head = document.createElement("thead");
        dt_head.innerHTML = `<tr><th colspan='2'>Key</th><th colspan='2'>Value</th><th><button id="btn_new_preset" class="opt-btn icon-green" disabled>Add</button></th></tr>`;

        const dt_body = document.createElement("tbody");
        dt_body.id = "storage-map-data-table-body";

        // rah rah rah. body data rendered in ui_render_spm_data_for_map

        data_table.appendChild(dt_head);
        data_table.appendChild(dt_body);

        const dt_foot = document.createElement("tfoot");
        dt_foot.innerHTML = `<tr><td colspan="5"><span class="data-count"></td></tr>`;

        data_table.appendChild(dt_foot);
        data_table_container.appendChild(data_table);
        this.sp_table_container.appendChild(data_table_container);
        sp_content_container.appendChild(this.sp_table_container);
        sp_content_container.style.display = 'block';

        const btn_new_preset = document.querySelector(`#btn_new_preset`) as HTMLButtonElement;
        btn_new_preset.addEventListener("click", () => {

            if(this.current_storage_map_uuid === DEFAULT_STRING) {
                console.log("Error: no storage map selected");
                return;
            }

            const new_preset_uuid = uuidv7();
            const new_preset = new StoragePreset();

            const smp = this.storage_preset_maps[this.current_storage_map_uuid].presets;
            smp[new_preset_uuid] = new_preset;
            localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));
            this.render_preset_row(new_preset_uuid, new_preset);
            this.count_presets_in_map();
        });
    }

    // this is assigned by the currently selected storage map.
    private render_preset_row = function (preset_uuid: string, preset: StoragePreset) {}

    private editstorage_preset(map_uuid: string, preset_uuid: string) {
        const _thisSE = this;

        if(preset_uuid === DEFAULT_STRING) {
            return;
        }

        function make_input_for_type(type_id: number, in_value: string | undefined = undefined) : HTMLElement {
            switch(true) {
                case (type_id < 6): {
                    const uint_input = document.createElement("input");
                    uint_input.setAttribute("type", `number`);
                    if(in_value !== undefined) {
                        uint_input.value = in_value;
                    }
                    return uint_input;
                }
                case (type_id === SILEX_TYPE_IDS["bool"]): {
                    const bool_type_select_input = document.createElement('select');
                    bool_type_select_input.classList.add("bool-select");
                    // add options
                    ["true", "false"].forEach(option => {
                       const option_el = document.createElement("option");
                       option_el.setAttribute("value", option);
                       option_el.textContent = option;
                       if(in_value !== undefined && option === in_value) {
                           option_el.setAttribute("selected", "");
                       }
                       bool_type_select_input.appendChild(option_el);
                    });
                    return bool_type_select_input;//bool
                }
                case (type_id === SILEX_TYPE_IDS["string"]): {
                    const string_input = document.createElement("textarea");
                    if(in_value !== undefined) {
                        string_input.value = in_value;
                    }
                    return string_input;
                }
            }

            const bad_input = document.createElement("div");
            bad_input.textContent = "Bad input";
            return bad_input;
        }

        // disable delete button

        const preset = _thisSE.storage_preset_maps[map_uuid].presets[preset_uuid];
        const tr = document.querySelector(`tr[data-uuid="${preset_uuid}"]`) as HTMLTableRowElement;

        let key_type_id = preset.key_type_id;
        let new_type_id = preset.value_type_id;
        let key = preset.key;
        let value = preset.value;

        const key_type_cell = tr.cells[0];
        const key_cell = tr.cells[1];
        const value_type_cell = tr.cells[2];
        const value_cell = tr.cells[3];

        // create the select menus
        const key_select_menu = document.createElement("select");
        key_select_menu.classList.add("key-type-select");
        Object.entries(SILEX_TYPE_IDS).forEach(([key, type_id]) => {
            const option = document.createElement("option");
            option.setAttribute("value", `${type_id}`);
            option.textContent = key.toString();
            key_select_menu.appendChild(option);
        })

        const value_select_menu = key_select_menu.cloneNode(true) as HTMLSelectElement;
        value_select_menu.classList.add("value-type-select");

        key_type_cell.replaceChildren();
        key_select_menu.selectedIndex = key_type_id;
        key_type_cell.appendChild(key_select_menu);

        value_type_cell.replaceChildren();
        value_select_menu.selectedIndex = new_type_id;
        value_type_cell.appendChild(value_select_menu);

        // end select menu creation.
        // key/value input creation.
        let key_current_type_id = key_type_id;
        let value_current_type_id = new_type_id;

        // the kv cells need to change input types base on the type id
        function cell_input_change(cell: HTMLElement, type_id: number, in_value: string | undefined = undefined, class_name: string = "") {
            cell.replaceChildren();
            const cell_input = make_input_for_type(type_id, in_value);
            cell_input.classList.add(class_name);
            cell.appendChild(cell_input);
        }

        cell_input_change(key_cell, key_type_id, key, "key-cell-input");
        cell_input_change(value_cell, new_type_id, value, "value-cell-input");

        // TODO: collapse these listeners?.
        key_select_menu.addEventListener("change", e => {
            const updated_type_id = parseInt(key_select_menu.value);
            const CLASS_NAME = "key-cell-input";
            switch(true) {
                case (key_current_type_id < 6 && updated_type_id < 6): { // uint
                    // leave as is
                    // NOTE: the user handles uint overflow errors directly in the input.
                    break;
                }

                default: {
                    cell_input_change(key_cell, updated_type_id, key, CLASS_NAME);
                }
            }

            key_current_type_id = updated_type_id;
        });

        value_select_menu.addEventListener("change", e => {
            const updated_type_id = parseInt(value_select_menu.value);
            const CLASS_NAME = "value-cell-input";
            switch(true) {
                case (value_current_type_id < 6 && updated_type_id < 6): { // uint
                    // leave as is
                    // NOTE: the user handles uint overflow errors directly in the input.
                    break;
                }

                default: {
                    cell_input_change(value_cell, updated_type_id, value, CLASS_NAME);
                }
            }

            value_current_type_id = updated_type_id;
        });
    }

    private delete_storage_preset(map_uuid: string, preset_uuid: string) {
        const _thisSE = this;

        if(preset_uuid === DEFAULT_STRING) {
            return;
        }

        const presets = _thisSE.storage_preset_maps[map_uuid].presets;
        delete presets[preset_uuid];

        localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));
    }

    ui_render_spm_data_for_map(map_uuid: MapUUID) {
        const _thisSE = this;

        const dt_body = document.querySelector(`#storage-map-data-table-body`) as HTMLTableSectionElement;
        dt_body.replaceChildren();

        this.map_name_input.value = _thisSE.storage_preset_maps[map_uuid].name;
        this.map_desc_input.value = _thisSE.storage_preset_maps[map_uuid].description;

        // set styles on icons
        EditIcon.classList.add("icon", "edit-icon");
        const edit_icon_html = Utils.convertSvgElementToHtml(EditIcon);
        DeleteIcon.classList.add("icon", "delete-icon");
        const delete_icon_html = Utils.convertSvgElementToHtml(DeleteIcon);

        this.count_presets_in_map(map_uuid);

        _thisSE.render_preset_row = function (preset_uuid: string, preset: StoragePreset) {
            const dt_tr = document.createElement("tr");
            dt_tr.setAttribute("data-uuid", preset_uuid);
            dt_tr.classList.add("storage-preset-row");

            let in_edit_mode = false;

            const tr_preset_cells: HTMLElement[] = [];

            ["cell-key-type",
                "cell-key",
                "cell-value-type",
                "cell-value"].forEach(opt => {

                const td = document.createElement("td");
                td.classList.add(opt);
                tr_preset_cells.push(td);

                dt_tr.appendChild(td);
            });

            function tr_read_only_mode(key_type: number, key: string, value_type: number, value: string) {
                tr_preset_cells.forEach(td => {
                    td.replaceChildren();
                });

                tr_preset_cells[0].textContent = get_type_name_with_id(key_type);
                tr_preset_cells[1].textContent = key;
                tr_preset_cells[2].textContent = get_type_name_with_id(value_type);
                tr_preset_cells[3].textContent = value;
            }

            tr_read_only_mode(preset.key_type_id, preset.key, preset.value_type_id, preset.value);

            const action_cell = document.createElement("td");
            // stop the action cell from responding to tr events
            action_cell.addEventListener("click", e => {
                e.stopPropagation();
            });

            const btn_group = document.createElement("div");
            btn_group.classList.add("graphic-button-group", "horizontal");

            const btn_edit_preset = document.createElement("button");
            const btn_delete_preset = document.createElement("button");

            [[btn_edit_preset, edit_icon_html]
                , [btn_delete_preset, delete_icon_html]
            ].forEach(([btn, svg]) => {
                const button = btn as HTMLButtonElement;
                const svg_html = svg as string;
                button.classList.add("icon-button");
                button.innerHTML = svg_html;
                btn_group.appendChild(button);
            });

            action_cell.appendChild(btn_group);

            btn_edit_preset.addEventListener("click", () => {
                if(in_edit_mode) {
                    const key_select = dt_tr.querySelector(`.key-type-select`) as HTMLSelectElement;
                    const key_cell = dt_tr.querySelector(`.key-cell-input`) as HTMLInputElement;
                    const value_select = dt_tr.querySelector(`.value-type-select`) as HTMLSelectElement;
                    const value_cell = dt_tr.querySelector(`.value-cell-input`) as HTMLInputElement;

                    preset.key_type_id = key_select.selectedIndex;
                    preset.key = key_cell.value;
                    preset.value_type_id = value_select.selectedIndex;
                    preset.value = value_cell.value;

                    tr_read_only_mode(preset.key_type_id, preset.key, preset.value_type_id, preset.value);
                    localStorage.setItem("storage_editor", JSON.stringify(StorageEditor._storage_editor));
                    in_edit_mode = false;
                } else {
                    in_edit_mode = true;
                    _thisSE.editstorage_preset(map_uuid, preset_uuid);
                }
            });

            btn_delete_preset.addEventListener("click", () => {
                _thisSE.delete_storage_preset(map_uuid, preset_uuid);
                dt_tr.remove();
                _thisSE.count_presets_in_map(map_uuid);
            }, {once: true});

            dt_tr.appendChild(action_cell);
            dt_body.appendChild(dt_tr);
        }

        Object.entries(_thisSE.storage_preset_maps[map_uuid].presets).forEach(([preset_uuid, preset]) => {
            _thisSE.render_preset_row(preset_uuid, preset);
        });

        this.current_storage_map_uuid = map_uuid;

        this.toggle_storage_editor_inputs();

    }

    private count_presets_in_map(map_uuid: string = this.current_storage_map_uuid) {
        const data_count = document.querySelector(`.storage-map-data .data-count`) as HTMLElement;
        if(data_count !== null) {
            const len = Object.values(this.storage_preset_maps[map_uuid].presets).length;
            data_count.textContent = `${len} item${len === 1 ? "" : "s"}`;
        }
    }

    private toggle_storage_editor_inputs() {

        const btn_add_preset = document.getElementById(`btn_new_preset`);

        if(this.current_storage_map_uuid === DEFAULT_STRING) {
            this.map_name_input.value = "";
            this.map_name_input.disabled = true;
            this.map_desc_input.value = "";
            this.map_desc_input.disabled = true;

            // cant add presets, and no map to delete.
            if(btn_add_preset !== null) {
                btn_add_preset.setAttribute("disabled", "");
                btn_add_preset.classList.add("disabled");
            }
            this.btn_delete_storage_map.setAttribute("disabled", "");
            this.btn_delete_storage_map.classList.add("disabled");
        } else {
            this.map_name_input.disabled = false;
            this.map_desc_input.disabled = false;

            this.btn_delete_storage_map.removeAttribute("disabled");
            this.btn_delete_storage_map.classList.remove("disabled");
            if(btn_add_preset !== null) {
                btn_add_preset.removeAttribute("disabled");
                btn_add_preset.classList.remove("disabled");
            }
        }
    }
}