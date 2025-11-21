import {rpc_api_data, RPCMethod, RPCParams} from "./rpc_api_data";
import {uuidv7} from "uuidv7";
import SearchIcon from "../resources/icons/search-icon.svg";
import LogIcon from "../resources/icons/log-icon.svg";
import DeleteIcon from "../resources/icons/trash-icon.svg";
import {Utils} from "../Utils";
import ReuseIcon from "../resources/icons/recycle-icon.svg";

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

export const DaemonEndpoint = "daemon";
export const WalletEndpoint = "wallet";
export type EndpointType = typeof DaemonEndpoint | typeof WalletEndpoint;
export class RPCInspector {
    rpc_url: string = "";

    endpoint: EndpointType;
    rpc_id: string;
    name: string = "RPC Server";
    description: string = "";

    authentication_required: boolean = false;
    rpc_username = "username";
    rpc_password = "password";

    rpc_url_input: HTMLInputElement;
    rpc_query_input: HTMLDivElement;
    rpc_response_out: HTMLElement;
    btn_rpc_connect: HTMLElement;
    btn_rpc_send: HTMLElement;
    rpc_header_section:  HTMLDivElement;
    api_list_item_container: HTMLDivElement;
    rpc_query: string = "";
    rpc_ready: boolean = false;
    ws: WebSocket | null = null;
    /* start off in command mode.
    * Todo: Preferences and local storage to remember last mode.
    * */
    ui_mode: UIMode = COMMAND_MODE;


    // the user may want to keep the api list open (pinned).
    ui_comman_mode_pinned: boolean = false;
    static rpc_api_list_container: HTMLElement = document.querySelector(`.rpc_api_list_container`) as HTMLElement;
    static rpc_inspector_response_section: HTMLElement = document.querySelector(`.rpc-inspector-response-section`) as HTMLElement;
    static all_rpc_inspectors: Map<string, RPCInspector>  = new Map<string, RPCInspector>();
    private btn_log_history: HTMLButtonElement;

    constructor(endpoint: EndpointType, rpc_name: string) {

        this.endpoint = endpoint;
        this.name = rpc_name;
        this.rpc_id = `${this.endpoint}-${uuidv7()}`;

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

        const rpc_node_input_container: HTMLDivElement  = document.createElement('div');

        const gap: HTMLDivElement = document.createElement('div');

        const node_input_html = `<div class="rpc-url-container">
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
                                        <div contenteditable="true" class="rpc_query" spellcheck="false"></div>
                                        <div id="rpc_query_display_hud">
                                        
                                            <button class="btn_api_info dialog-btn btn" style="visibility: hidden;">API</button>
                                            <!--div class="legend-container">
                                                <div class="legend gold">REQUIRED</div>
                                                <div class="legend purple">Optional</div>
                                            </div-->
                                            <button class="btn_rpc_send dialog-btn btn right">Send</button>
                                       
                                        </div>
                                    </div>`;

        new Map<string, {elem: HTMLDivElement, html: string }>([
            ["rpc-node-input-container", {elem: rpc_node_input_container, html: node_input_html}],

            ["gap", {elem: gap, html: ""}]
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
        LogIcon.classList.add("icon", "delete-icon");
        this.btn_log_history = document.createElement('button') as HTMLButtonElement;
        this.btn_log_history.classList.add("icon-button", "with-tooltip");
        this.btn_log_history.setAttribute("data-tooltip", "Enable log history");
        const data_toggle = localStorage.getItem("rpc_log_history") === "off" ? "off" : "on";
        this.btn_log_history.setAttribute("data-toggle", data_toggle);
        this.btn_log_history.innerHTML =  Utils.convertSvgElementToHtml(LogIcon) as string;

        DeleteIcon.classList.add("icon", "delete-icon");
        const btn_clear_response_out = document.createElement('button') as HTMLButtonElement;
        btn_clear_response_out.classList.add("icon-button", "with-tooltip");
        btn_clear_response_out.setAttribute("data-tooltip", "Clear log");
        btn_clear_response_out.setAttribute("data-toggle", "off");
        btn_clear_response_out.innerHTML =  Utils.convertSvgElementToHtml(DeleteIcon) as string;

        resp_disp_prefs.appendChild(this.btn_log_history);
        resp_disp_prefs.appendChild(btn_clear_response_out);

        /* toggle between single response and multiple response mode */
        this.btn_log_history.addEventListener("click" , () => {
            if(this.btn_log_history.getAttribute("data-toggle") === "on") {
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

        this.rpc_url = localStorage.getItem(this.endpoint === DaemonEndpoint? "rpc_daemon_url" : "rpc_wallet_url") || this.rpc_url;

        if(this.rpc_url.trim() === "") {
            switch(this.endpoint) {
                case DaemonEndpoint:
                    this.rpc_url = DAEMON_DEFAULT_URL;
                    break;

                case WalletEndpoint:
                    this.rpc_url = WALLET_DEFAULT_URL;
            }
        }

        this.rpc_url_input.value = this.rpc_url;

        const btn_api_info = this.rpc_header_section.querySelector('.btn_api_info') as HTMLElement;
        btn_api_info.addEventListener('click', () => {
            this.ui_command_mode();
        });

        rpc_tab_button.addEventListener('click', () => {RPCInspector.switch_inspector_view(this);});
        this.rpc_url_input.addEventListener('change', (e) => {this.rpc_url = (e.target as HTMLInputElement).value;});

        this.btn_rpc_connect.addEventListener('click', () => {this.connect();});

        this.btn_rpc_send.addEventListener('click', () => {
            if(this.ws === null) {
                this.log(`<error><b>Error</b>: Client not connected to a source. Please connect first.</error>`);
                return;
            }

            this.send_rpc_query();
        });

        /* clear the response log */
        btn_clear_response_out.addEventListener('click', () => {this.rpc_response_out.innerHTML = "";});

        this.ui_render_api_list_container();

        RPCInspector.all_rpc_inspectors.set(this.rpc_id, this);
        RPCInspector.switch_inspector_view(this);

        this.connect();
    }

    connect() {
        const SCHEMA_ID = 255;

        if(this.ws !== null) {
            this.log(`Closing existing connection...`);
            this.ws.close();
        }

        localStorage.setItem(this.endpoint === DaemonEndpoint? "rpc_daemon_url" : "rpc_wallet_url", this.rpc_url);

        this.log(`Connecting to <url>${this.rpc_url}</url>...`);

        const url = this.authentication_required ? `${this.rpc_username}:${this.rpc_password}@${this.rpc_url}`: `${this.rpc_url}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {

            let conn_url_msg = this.btn_log_history.getAttribute("data-toggle") === "on" ? "" : ` to <url>${this.rpc_url}</url>`;

            this.log(`Connected${conn_url_msg}.`);

            const schema_method = `{"id":${SCHEMA_ID},"jsonrpc":"2.0","method":"schema"}`;
            this.ws?.send(schema_method);
        };

       this.ws.onmessage = (event) => {

           const rpc_response = JSON.parse(event.data);
           if(rpc_response.error !== undefined) {
               this.log(`<error>${rpc_response.error.message}</error>`, ResponseMessage);
           }

           if(rpc_response.id === SCHEMA_ID) {
               this.rpc_ready = true; // Notify UI - "send" button can be enabled
               console.log(rpc_response);
               this.load_api_list(rpc_response);
               return;
           }

            this.log(`<response><rpc_notify>Received: </rpc_notify><data>${event.data}</data></response>`, ResponseMessage);
            // ws.close(); // Keep open for testing or close if desired
        };

       this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.log(`<error>Error: See console for details. (Check if server is running and CORS/Auth is correct)</error>`);
        };

        this.ws.onclose = () => {
            this.log('Disconnected');
            this.rpc_ready = false;
            // ui notify
        };

        return this.ws as WebSocket;
    }

    send_rpc_query() {
        if(this.ws === null) {
            this.log(`<error><b>Error</b>: Client not connected to a source. Please connect first.</error>`);
            return;
        }
        this.rpc_query = this.rpc_query_input.textContent;

        try {
            let parsed_query = JSON.parse(this.rpc_query);
            parsed_query = JSON.stringify(parsed_query);

            this.log(`<request><rpc_notify>Sending: </rpc_notify><data>${parsed_query}</data></request>`, RequestMessage);
            this.ws.send(parsed_query);
        } catch (error) {
            this.log(`<error>${error}</error>`);
            this.log(`<warn>NOTE: Relaxed JSON is unsupported. Use strict JSON only.</warn>`);
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

        SearchIcon.classList.add("icon", "delete-icon");
        const btn_search_api = document.createElement('button') as HTMLButtonElement;
        btn_search_api.classList.add("icon-button", "with-tooltip");
        btn_search_api.setAttribute("data-tooltip", "Search for Method");
        btn_search_api.setAttribute("data-toggle", "off");
        btn_search_api.style.visibility = "hidden";
        //btn_search_api.setAttribute("disabled", "");

        btn_search_api.innerHTML =  Utils.convertSvgElementToHtml(SearchIcon) as string;
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

    load_api_list(rpc_response: any) {

        // TODO: SWAP THE FOLLOWING FOR THE SCHEMA RESTURNED BY rpc_response.

        const maybeApiData = rpc_api_data.get(this.endpoint);

        if(maybeApiData === undefined) {
            console.warn(`RPC API data not found for ${this.endpoint}`);
            return;
        }

        maybeApiData.forEach((template, api_cmd) => {
            const api_item = document.createElement('div');
            api_item.classList.add('rpc-api-item');
            api_item.setAttribute("data-cmd", api_cmd);

            // temporary rpc method type indicator
            let param_count;
            switch (template) {
                case "":
                    param_count = "params-none";
                    break;

                case "{}":
                    param_count = "params-unknown";
                    break;

                    default:
                        param_count = "params-n";
            }

            api_item.innerHTML = `<label class="${param_count}">${api_cmd}</label>`;
            this.api_list_item_container.appendChild(api_item);

            api_item.addEventListener('click', (e) => {

                const api_cmd_required = `"id":1,"jsonrpc":"2.0","method":"${api_cmd}"`;

                const query_input = document.querySelector(`.rpc-inspector-header-section[data-rpc-id="${this.rpc_id}"] .rpc_query`) as HTMLDivElement;

                if(template === "") {
                    query_input.innerHTML = `{${api_cmd_required}}`; // req without params
                    // might as well excute without having to click send
                    this.send_rpc_query();

                } else {
                    query_input.innerHTML = `{${api_cmd_required}, "params": ${template}}`;
                }
            });
        });
    }
    static switch_inspector_view(inspector: RPCInspector) {

        const all_view_btns = document.querySelectorAll('.rpc-selector-container > button');
        all_view_btns.forEach((btn) => {
            const btn_rpc_id = btn.getAttribute("data-rpc-id");
            if(btn_rpc_id !== inspector.rpc_id) {
                btn.removeAttribute("disabled");
                btn.classList.remove("selected");
                btn.classList.add("knockout");

                // hide UI elements for this rpc_id
                const inspector_elems = document.querySelectorAll(`div[data-rpc-id="${btn_rpc_id}"]`) as NodeListOf<HTMLElement>;
                inspector_elems.forEach((inspector_elem) => {
                    inspector_elem.style.display = "none";
                });
            }

            if(btn_rpc_id === inspector.rpc_id ) {
                btn.setAttribute("disabled", "");
                btn.classList.add("selected");
                btn.classList.remove("knockout");

                // show UI elements for this rpc_id
                const inspector_elems = document.querySelectorAll(`div[data-rpc-id="${btn_rpc_id}"]`) as NodeListOf<HTMLElement>;
                inspector_elems.forEach((inspector_elem) => {
                    if(!inspector_elem.classList.contains("rpc_api_list")) {
                        inspector_elem.style.display = "block";
                    }
                });

                const command_mode_elems: string[] = ["rpc_api_list"];
                switch(inspector.ui_mode) {
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

        if(rpc_api_list !== null) {
            rpc_api_list.style.display = "block";
        }

        this.ui_mode = COMMAND_MODE;
    }

    log(msg: string, message_type: LogMessage = AppMessage) {
        const line = document.createElement('div');
        line.classList.add(`${message_type}-msg`, "log-msg");
        line.innerHTML = `<date>[${new Date().toLocaleTimeString()}]</date> <json>${msg}</json>`;

        if(message_type === ResponseMessage) {
            const json_data = line.querySelector('data') as HTMLElement;
            if(json_data !== null) {
                try {
                    const parsed_json = JSON.parse(json_data.textContent || "");
                    json_data.textContent = JSON.stringify(parsed_json, null, 2);
                } catch (error) {
                    console.error("Error parsing JSON:", error);
                }
            }
        }

        this.rpc_response_out.appendChild(line);

        if(this.btn_log_history.getAttribute("data-toggle") === "on") {
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
        if(last_request_item.length > 0) {
            last_request_item[last_request_item.length - 1].classList.add('last-request-msg');
            last_request_item[last_request_item.length - 1].classList.remove('hidden');
        }

        const last_response_item = this.rpc_response_out.lastElementChild as HTMLElement;
        last_response_item.classList.remove('hidden');

        RPCInspector.rpc_inspector_response_section.scrollTop = RPCInspector.rpc_inspector_response_section.scrollHeight;
    }
}
