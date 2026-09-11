import { uuidv7 } from "uuidv7";
import { getSearchIconHtml, getLogIconHtml, getDeleteIconHtml } from "../resources/icons";
import { Utils } from "../Utils";
import { EndpointType, DaemonEndpoint, WalletEndpoint } from "./types";
import { ApiUI, RPCMethodSchema, schemaHasParams } from "./api_ui";
import { endpoint_method_option_map, MethodOptions, MethodOptionsMap } from "./method_callbacks";
import { XelisWallet } from "@xelis/xelis-wallet-connect";

//const xelis_io_rpc_url = 'wss://node.xelis.io/json_rpc';
const DAEMON_DEFAULT_URL = 'ws://localhost:8080/json_rpc';
const WALLET_DEFAULT_URL = 'ws://username:password@localhost:8081/json_rpc';

/* UI modes */
const DEFAULT_MODE = "default";
const COMMAND_MODE = "command";
export type UIMode = typeof DEFAULT_MODE | typeof COMMAND_MODE;

/* Log message types: network, request, response, application */
const NetworkMessage = "network";
const RequestMessage = "request";
const ResponseMessage = "response";
const AppMessage = "application";
type LogMessage = typeof NetworkMessage | typeof RequestMessage | typeof ResponseMessage | typeof AppMessage;

/** temporary until we sort out postfetch **/
export const POSTPERMISSIONS = [
    "batch_limit",
    "build_transaction_offline",
    "build_unsigned_transaction",
    "clear_tx_cache",
    "count_matching_entries",
    "create_balance_proof",
    "create_ownership_proof",
    "decrypt_ciphertext",
    "decrypt_extra_data",
    "delete",
    "delete_tree_entries",
    "dump_transaction",
    "estimate_extra_data_size",
    "estimate_fees",
    "finalize_unsigned_transaction",
    "get_asset",
    "get_asset_precision",
    "get_assets",
    "get_matching_keys",
    "get_network",
    "get_nonce",
    "get_pending_transactions",
    "get_topoheight",
    "get_tracked_assets",
    "get_transaction",
    "get_value_from_key",
    "get_version",
    "has_balance",
    "has_key",
    "is_asset_tracked",
    "is_online",
    "list_transactions",
    "query_db",
    "rescan",
    "search_transaction",
    "set_offline_mode",
    "set_online_mode",
    "sign_data",
    "sign_unsigned_transaction",
    "split_address",
    "store",
    "subscribe",
    "track_asset",
    "unsubscribe",
    "untrack_asset",
    "verify_human_readable_proof",
    "verify_signed_data",
    "xswd.prefetch_permissions"
];

const SCHEMA_ID = 255;
export class RPCInspector {

    static readonly MSG = Object.freeze({
        NO_WALLET_CONNECTED: "NO WALLET (ACCOUNT) CONNECTED",
        NO_RPC_SERVER_AVAILABLE: "NO RPC SERVER AVAILABLE",
    });

    rpc_url: string = "";

    endpoint: EndpointType;
    rpc_id: string;
    name: string = "RPC Server";
    description: string = "";

    authentication_required: boolean = false;

    rpc_url_input: HTMLInputElement;
    rpc_query_input: HTMLDivElement;
    rpc_response_out: HTMLElement;
    btn_rpc_connect: HTMLElement;
    btn_rpc_send: HTMLElement;
    rpc_header_section: HTMLDivElement;
    api_list_item_container: HTMLDivElement;
    rpc_query: string = "";
    rpc_ready: boolean = false;
    ws: WebSocket | null = null;
    /* start off in command mode.
    * Todo: Preferences and local storage to remember last mode.
    * */
    ui_mode: UIMode = COMMAND_MODE;

    willReconnect: Boolean = false;

    private api_ui: ApiUI | null = null;
    private query_ui_editor: HTMLElement;

    xelisWallet: XelisWallet | null = null;


    // the user may want to keep the api list open (pinned).
    // ui_command_mode_pinned: boolean = false;
    static rpc_api_list_container: HTMLElement = document.querySelector(`.rpc_api_list_container`) as HTMLElement;
    static rpc_inspector_response_section: HTMLElement = document.querySelector(`.rpc-inspector-response-section`) as HTMLElement;
    static all_rpc_inspectors: Map<string, RPCInspector> = new Map<string, RPCInspector>();
    private readonly btn_log_history: HTMLButtonElement;

    constructor(endpoint: EndpointType, rpc_name: string, xelisWallet: XelisWallet | null = null) {

        this.endpoint = endpoint;
        this.name = rpc_name; xelisWallet
        this.rpc_id = `${this.endpoint}-${uuidv7()}`;

        this.xelisWallet = xelisWallet;

        console.log(`RPC Inspector: ${this.name} - (${this.rpc_id})`);

        const rpc_tab_button = document.createElement('button');
        rpc_tab_button.classList.add('light-teal-btn-style', 'btn', 'dialog-btn');

        rpc_tab_button.setAttribute("data-rpc", this.endpoint);
        rpc_tab_button.setAttribute("data-rpc-id", this.rpc_id);
        //rpc_tab_button.setAttribute("disabled", "");

        rpc_tab_button.innerHTML = this.name;

        document.querySelector('.rpc-selector-container')?.appendChild(rpc_tab_button);
        //rpc_tab_button.addEventListener('click', () => {RPCInspector.switch_inspector_view(this.rpc_id);});

        const st_rpc_container = document.getElementById(`st-rpc-container`) as HTMLElement;
        this.rpc_header_section = document.createElement('div');
        this.rpc_header_section.classList.add('rpc-inspector-header-section');
        this.rpc_header_section.setAttribute("data-rpc-id", this.rpc_id);

        const rpc_node_input_container: HTMLDivElement = document.createElement('div');

        const gap: HTMLDivElement = document.createElement('div');

        const node_input_html = /*html*/ `<div class="rpc-url-container" data-endpoint="${this.endpoint}">
                                        <div class="server-url-container">
                                            <div class="label-2 title1">ENDPOINT</div>
                                            <div>
                                                <input class="rpc_url_input" type="text" placeholder="" spellcheck="false">
                                            </div>
                                        </div>
                                        <div class="server-stat">
                                            <button class="btn_rpc_connect dialog-btn btn">Connect</button>
                                        </div>
                                    </div>
                                    <h2 class="title1">RPC REQUEST</h2>
                                    <div class="rpc_query_container">
                                        <div class="query_editor"></div>
                                        <div contenteditable="true" class="rpc_query" spellcheck="false"></div>
                                        <div id="rpc_query_display_hud">
                                        <button class="btn-edit-method-input dialog-btn btn hide" style="">Edit</button>
            
                                            <div class="btn-method-json-container hide">
                                                <button class="btn-method-json dialog-btn btn" style="">JSON</button>
                                            </div>
                                            
                                            <div><button class="btn_api_info dialog-btn btn" style="visibility: hidden;">API</button></div>
                                            
                                            <!--div class="legend-container">
                                                <div class="legend gold">REQUIRED</div>
                                                <div class="legend purple">Optional</div>
                                            </div-->
                                            <div><button class="btn_rpc_send dialog-btn btn right">Send</button></div>
                                            
                                       
                                        </div>
                                    </div>`;

        new Map<string, { elem: HTMLDivElement, html: string }>([
            ["rpc-node-input-container", { elem: rpc_node_input_container, html: node_input_html }],

            ["gap", { elem: gap, html: "" }]
        ]).forEach((div_obj, cn) => {
            div_obj.elem.classList.add(cn);
            div_obj.elem.innerHTML = div_obj.html
            this.rpc_header_section.appendChild(div_obj.elem);
        });

        st_rpc_container.appendChild(this.rpc_header_section);

        this.rpc_url_input = this.rpc_header_section.querySelector('.rpc_url_input') as HTMLInputElement;
        this.rpc_query_input = this.rpc_header_section.querySelector('.rpc_query') as HTMLDivElement;

        this.btn_rpc_connect = this.rpc_header_section.querySelector('.btn_rpc_connect') as HTMLElement;
        this.btn_rpc_send = this.rpc_header_section.querySelector('.btn_rpc_send') as HTMLElement;

        /* Response section */
        const rpc_response_item = document.createElement("div");
        rpc_response_item.classList.add("rpc-api-response-item");
        rpc_response_item.setAttribute("data-rpc-id", this.rpc_id);

        const rpca_resp_header = document.createElement("div");
        rpca_resp_header.classList.add("rpc-response-item-header");

        const header_control_section = document.createElement("div");
        header_control_section.classList.add("header-control-section");

        rpca_resp_header.appendChild(header_control_section);

        const rpc_api_response_title = document.createElement("div");
        rpc_api_response_title.classList.add("rpc-api-response-title", "title1");
        rpc_api_response_title.innerHTML = "RPC Response";

        header_control_section.appendChild(rpc_api_response_title);

        const resp_disp_prefs = document.createElement("div");
        resp_disp_prefs.classList.add("resp-disp-prefs", "prefs", "right-icons");

        /* icons */
        this.btn_log_history = document.createElement('button') as HTMLButtonElement;
        this.btn_log_history.classList.add("icon-button", "with-tooltip");
        this.btn_log_history.setAttribute("data-tooltip", "Enable log history");
        const data_toggle = localStorage.getItem("rpc_log_history") === "off" ? "off" : "on";
        this.btn_log_history.setAttribute("data-toggle", data_toggle);
        this.btn_log_history.innerHTML = getLogIconHtml("icon", "delete-icon");

        const btn_clear_response_out = document.createElement('button') as HTMLButtonElement;
        btn_clear_response_out.classList.add("icon-button", "with-tooltip");
        btn_clear_response_out.setAttribute("data-tooltip", "Clear log");
        btn_clear_response_out.setAttribute("data-toggle", "off");
        btn_clear_response_out.innerHTML = getDeleteIconHtml("icon", "delete-icon");

        resp_disp_prefs.appendChild(this.btn_log_history);
        resp_disp_prefs.appendChild(btn_clear_response_out);

        /* toggle between single response and multiple response mode */
        this.btn_log_history.addEventListener("click", () => {
            if (this.btn_log_history.getAttribute("data-toggle") === "on") {
                this.btn_log_history.setAttribute("data-toggle", "off");
                this.show_last_request_and_response();
            } else {
                this.btn_log_history.setAttribute("data-toggle", "on");
                this.show_all_log_items();
            }

            localStorage.setItem("rpc_log_history", this.btn_log_history.getAttribute("data-toggle") === "on" ? "on" : "off");
        })

        /* end icons */

        header_control_section.appendChild(resp_disp_prefs);

        const res_gap = document.createElement('div');
        res_gap.classList.add('gap');
        rpca_resp_header.appendChild(res_gap);

        rpc_response_item.appendChild(rpca_resp_header);

        this.rpc_response_out = document.createElement(`div`);
        this.rpc_response_out.classList.add(`rpc-response-out`);
        this.rpc_response_out.setAttribute("data-rpc-id", this.rpc_id);

        const lock = document.createElement('div');
        lock.classList.add('lock');

        const move = document.createElement('div');
        move.classList.add('move');

        lock.appendChild(move);

        move.appendChild(this.rpc_response_out);

        rpc_response_item.appendChild(lock);

        RPCInspector.rpc_inspector_response_section.appendChild(rpc_response_item);

        /* End of response section */

        this.api_list_item_container = document.createElement('div');
        this.api_list_item_container.classList.add('rpc_api_list');
        this.api_list_item_container.setAttribute("data-rpc", this.endpoint);
        this.api_list_item_container.setAttribute("data-rpc-id", this.rpc_id);

        this.rpc_url = localStorage.getItem(this.endpoint === DaemonEndpoint ? "rpc_daemon_url" : "rpc_wallet_url") || this.rpc_url;

        if (this.rpc_url.trim() === "") {
            switch (this.endpoint) {
                case DaemonEndpoint:
                    this.rpc_url = DAEMON_DEFAULT_URL;
                    break;

                case WalletEndpoint:
                    this.rpc_url = WALLET_DEFAULT_URL;
            }
        }

        this.rpc_url_input.value = this.rpc_url;

        this.query_ui_editor = document.querySelector(`[data-rpc-id="${this.rpc_id}"] .query_editor`) as HTMLElement;
        this.query_ui_editor.classList.add('hide');

        const btn_edit_method = document.querySelector(`[data-rpc-id="${this.rpc_id}"] .btn-edit-method-input`) as HTMLButtonElement;
        const btn_method_json_container = document.querySelector(`[data-rpc-id="${this.rpc_id}"] .btn-method-json-container`) as HTMLElement;

        btn_edit_method.addEventListener('click', () => {

            const query_input = document.querySelector(`[data-rpc-id="${this.rpc_id}"] .rpc_query`) as HTMLDivElement;
            query_input.classList.add('hide');
            this.query_ui_editor.classList.remove('hide');

            btn_edit_method.classList.add('hide');
            btn_method_json_container.classList.remove('hide');
        });


        // hidden away for now...
        const btn_api_info = this.rpc_header_section.querySelector('.btn_api_info') as HTMLElement;
        btn_api_info.addEventListener('click', () => {
            this.ui_command_mode();
        });

        rpc_tab_button.addEventListener('click', () => { RPCInspector.switch_inspector_view(this); });
        this.rpc_url_input.addEventListener('change', (e) => { this.rpc_url = (e.target as HTMLInputElement).value; });

        this.btn_rpc_connect.addEventListener('click', () => { this.connect(); });

        this.btn_rpc_send.addEventListener('click', () => {
            if ((this.endpoint === DaemonEndpoint && this.ws === null) || (this.endpoint === WalletEndpoint && this.xelisWallet === null)) {
                this.rpcLog(`<error><b>Error</b>: Client not connected to a source. Please connect first.</error>`);
                return;
            }

            this.send_rpc_query();
        });

        /* clear the response log */
        btn_clear_response_out.addEventListener('click', () => { this.rpc_response_out.innerHTML = ""; });

        this.ui_render_api_list_container();

        RPCInspector.all_rpc_inspectors.set(this.rpc_id, this);
        RPCInspector.switch_inspector_view(this);
        if (this.endpoint !== WalletEndpoint) { // wallet now uses xswd.
            this.connect();
        }
    }

    connect() {   // now only makes sense for the daemon endpoint.
        if (this.ws !== null) {
            this.rpcLog(`Closing existing connection...`);
            this.willReconnect = true;
            this.ws.close();
        }

        localStorage.setItem(this.endpoint === DaemonEndpoint ? "rpc_daemon_url" : "rpc_wallet_url", this.rpc_url);

        this.ws = new WebSocket(this.rpc_url);

        this.ws.onopen = () => {

            let conn_url_msg = this.btn_log_history.getAttribute("data-toggle") === "on" ? "" : ` to <url>${this.rpc_url}</url>`;

            this.rpcLog(`Connected${conn_url_msg}.`);

            const schema_method = `{"id":"${this.endpoint}:schema","jsonrpc":"2.0","method":"schema"}`;
            this.ws?.send(schema_method);
        };

        this.ws.onmessage = (event) => {
            const rpc_response = JSON.parse(event.data);
            this.processResponse(rpc_response);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.rpcLog(`<error>Error: See console for details. (Check if server is running and CORS/Auth is correct)</error>`);
        };

        this.ws.onclose = () => {
            if (this.willReconnect) {
                this.rpcLog('Reconnected.');
                this.willReconnect = false;
            } else {
                this.rpcLog('Disconnected');
            }
            this.rpc_ready = false;
            // ui notify
        };

        return this.ws as WebSocket;
    }

    send_rpc_query() {
        if ((this.endpoint === DaemonEndpoint && this.ws === null) || (this.endpoint === WalletEndpoint && this.xelisWallet === null)) {
            this.rpcLog(`<error><b>Error</b>: Client not connected to a source. Please connect first.</error>`);
            return;
        }

        if (this.query_ui_editor && !this.query_ui_editor.classList.contains('hide') && this.api_ui) {
            this.api_ui.updateQueryInputFromForm();
        }

        this.rpc_query = this.rpc_query_input.textContent || "";

        try {
            let parsed_query = JSON.parse(this.rpc_query);
            parsed_query = JSON.stringify(parsed_query);

            this.rpcLog(`<request><rpc_notify>Sending: </rpc_notify><data>${parsed_query}</data></request>`, RequestMessage);

            if (this.endpoint === DaemonEndpoint) {
                this.ws?.send(parsed_query);
            } else {
                this.xelisWallet?.send_query(parsed_query);
            }

        } catch (error) {
            this.rpcLog(`<error>${error}</error>`);
            this.rpcLog(`<warn>NOTE: Relaxed JSON is unsupported. Use strict JSON only.</warn>`);
        }
    }

    ui_render_api_list_container() {
        const rpc_api_list_item = document.createElement("div");
        rpc_api_list_item.classList.add("rpc-api-list-item");
        rpc_api_list_item.setAttribute("data-rpc-id", this.rpc_id);

        const rpca_li_header = document.createElement("div");
        rpca_li_header.classList.add("rpc-api-list-item-header");

        const header_control_section = document.createElement("div");
        header_control_section.classList.add("header-control-section");

        rpca_li_header.appendChild(header_control_section);

        const rpc_api_list_item_title = document.createElement("div");
        rpc_api_list_item_title.classList.add("rpc-api-list-item-title", "title1");
        rpc_api_list_item_title.innerHTML = "Methods";

        header_control_section.appendChild(rpc_api_list_item_title);

        const api_li_disp_prefs = document.createElement("div");
        api_li_disp_prefs.classList.add("api-li-disp-prefs", "prefs", "right-icons");

        const btn_search_api = document.createElement('button') as HTMLButtonElement;
        btn_search_api.classList.add("icon-button", "with-tooltip");
        btn_search_api.setAttribute("data-tooltip", "Search for Method");
        btn_search_api.setAttribute("data-toggle", "off");
        btn_search_api.style.visibility = "hidden";
        //btn_search_api.setAttribute("disabled", "");

        btn_search_api.innerHTML = getSearchIconHtml("icon", "delete-icon");
        api_li_disp_prefs.appendChild(btn_search_api);

        header_control_section.appendChild(api_li_disp_prefs);

        const gap = document.createElement('div');
        gap.classList.add('gap');
        rpca_li_header.appendChild(gap);

        rpc_api_list_item.appendChild(rpca_li_header);

        const lock = document.createElement('div');
        lock.classList.add('lock');

        const move = document.createElement('div');
        move.classList.add('move');

        lock.appendChild(move);

        //this.api_list_item_container

        move.appendChild(this.api_list_item_container);

        rpc_api_list_item.appendChild(lock);
        RPCInspector.rpc_api_list_container.appendChild(rpc_api_list_item);
    }

    load_api_list(rpc_method_schema: RPCMethodSchema[]) {
        this.api_list_item_container.innerHTML = "";

        rpc_method_schema.forEach((api_method: RPCMethodSchema) => {
            const api_elem = document.createElement('div');
            api_elem.classList.add('rpc-api-item');
            api_elem.setAttribute("data-cmd", api_method.name);

            const has_params = schemaHasParams(api_method.schema.params_schema);
            const param_count = has_params ? "params-n" : "params-none";

            api_elem.innerHTML = `<label class="${param_count}">${api_method.name}</label>`;
            this.api_list_item_container.appendChild(api_elem);
        });
    }

    clearMethodList() {
        this.api_list_item_container.innerHTML = '';
        // clear rpc-response-out
        this.rpc_response_out.innerHTML = '';
        this.rpc_query_input.innerHTML = '';
    }

    static switch_inspector_view(inspector: RPCInspector) {

        const all_view_btns = document.querySelectorAll('.rpc-selector-container > button');
        all_view_btns.forEach((btn) => {
            const btn_rpc_id = btn.getAttribute("data-rpc-id");
            if (btn_rpc_id !== inspector.rpc_id) {
                btn.removeAttribute("disabled");
                btn.classList.remove("selected");
                btn.classList.add("knockout");

                // hide UI elements for this rpc_id
                const inspector_elems = document.querySelectorAll(`div[data-rpc-id="${btn_rpc_id}"]`) as NodeListOf<HTMLElement>;
                inspector_elems.forEach((inspector_elem) => {
                    inspector_elem.style.display = "none";
                });
            }

            if (btn_rpc_id === inspector.rpc_id) {
                btn.setAttribute("disabled", "");
                btn.classList.add("selected");
                btn.classList.remove("knockout");

                // show UI elements for this rpc_id
                const inspector_elems = document.querySelectorAll(`div[data-rpc-id="${btn_rpc_id}"]`) as NodeListOf<HTMLElement>;
                inspector_elems.forEach((inspector_elem) => {
                    if (!inspector_elem.classList.contains("rpc_api_list")) {
                        inspector_elem.style.display = "block";
                    }
                });

                const command_mode_elems: string[] = ["rpc_api_list"];
                switch (inspector.ui_mode) {
                    case COMMAND_MODE:
                        inspector.ui_command_mode();
                        break;

                    default:
                        break;

                }
            }
        });
    }

    private ui_command_mode() {
        const rpc_api_list: HTMLDivElement | null = document.querySelector(`.rpc_api_list[data-rpc-id="${this.rpc_id}"]`);

        if (rpc_api_list !== null) {
            rpc_api_list.style.display = "block";
        }

        this.ui_mode = COMMAND_MODE;
    }

    rpcLog(msg: string, message_type: LogMessage = AppMessage) {
        const line = document.createElement('div');
        line.classList.add(`${message_type}-msg`, "log-msg");
        line.innerHTML = `<date>[${new Date().toLocaleTimeString()}]</date> <json>${msg}</json>`;

        if (message_type === ResponseMessage) {
            const json_data = line.querySelector('data') as HTMLElement;
            if (json_data !== null) {
                try {
                    const parsed_json = JSON.parse(json_data.textContent || "");
                    json_data.textContent = JSON.stringify(parsed_json, null, 2);
                } catch (error) {
                    json_data.textContent = "Error parsing JSON: " + error;
                }
            }
        }

        this.rpc_response_out.appendChild(line);

        if (this.btn_log_history.getAttribute("data-toggle") === "on") {
            this.show_all_log_items();
        } else {
            this.show_last_request_and_response()
        }
    }

    private show_all_log_items() {
        this.rpc_response_out.querySelectorAll('.log-msg').forEach(element => {
            element.classList.remove('hidden');
            element.classList.remove('last-request-msg');
        });
        RPCInspector.rpc_inspector_response_section.scrollTop = RPCInspector.rpc_inspector_response_section.scrollHeight;
    }

    /* show the last request and response */
    private show_last_request_and_response() {
        this.rpc_response_out.querySelectorAll('.log-msg').forEach(element => {
            element.classList.add('hidden');
        });

        const last_request_item = this.rpc_response_out.querySelectorAll('.request-msg');
        if (last_request_item.length > 0) {
            last_request_item[last_request_item.length - 1].classList.add('last-request-msg');
            last_request_item[last_request_item.length - 1].classList.remove('hidden');
        }

        const last_response_item = this.rpc_response_out.lastElementChild as HTMLElement;
        last_response_item.classList.remove('hidden');

        RPCInspector.rpc_inspector_response_section.scrollTop = RPCInspector.rpc_inspector_response_section.scrollHeight;
    }

    public processResponse(rpc_response: any) {

        console.log("[RPC Inspector]", rpc_response);
        if (rpc_response.error !== undefined) {
            this.rpcLog(`<error>${rpc_response.error.message}</error>`, ResponseMessage);
        }

        if (rpc_response.id === `${this.endpoint}:schema`) {
            this.rpc_ready = true; // Notify UI - "send" button can be enabled
            //console.log(rpc_response);

            /* We need to make each method have a unique send id to handle things
            * like summary callbacks (method_callbacks.ts)
            * */
            let rpc_method_schema: RPCMethodSchema[] = rpc_response.result.methods as unknown as RPCMethodSchema[];

            let method_id = 0;
            rpc_method_schema.forEach((api_method: RPCMethodSchema) => {
                api_method.method_id = ++method_id;
            });

            console.log("[RPCInspector]", rpc_method_schema)

            this.load_api_list(rpc_method_schema);
            this.api_ui = new ApiUI(rpc_method_schema, this.endpoint, true, this.rpc_id, this.query_ui_editor, this);

            return;
        }

        this.rpcLog(`<response><rpc_notify>Received: </rpc_notify><data>${JSON.stringify(rpc_response, null, 2)}</data></response>`, ResponseMessage);
        //
        // const data = rpc_response.results.methods;
        // console.log(`Checking callback for method_id ${data.id} at endpoint ${this.endpoint}`);
        //
        // const mom = endpoint_method_option_map.get(this.endpoint) as MethodOptionsMap;
        //
        // if (this.api_ui === null) {
        //     return;
        // }
        //
        // const methods = this.api_ui?.methods as RPCMethodSchema[];
        //
        // for(const method of methods) {
        //     if(method.method_id === data.id) {
        //         const method_opts = mom.get(method.name);
        //         if(method_opts !== undefined) {
        //             method_opts.post_response(data);
        //         }
        //
        //         break;
        //     }
        // }
    }
}
