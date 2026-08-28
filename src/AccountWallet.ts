import {XelisWallet} from "@xelis/xelis-wallet-connect";
import {App} from "./app";
import {POSTPERMISSIONS, RPCInspector} from "./RPCInspector";
import {WalletEndpoint} from "./RPCInspector/types";

export function accountWallet(_thisApp: App) {
    const wallet_container = document.getElementById('wallet_container') as HTMLDivElement;
    const PERMISSIONS = [
        "get_address",
        "get_balance",
        "network_info",
        "build_transaction",
        "schema"
    ].concat(POSTPERMISSIONS);

    _thisApp.xelisWallet = new XelisWallet(wallet_container,
        {
            appData: {
                name: "Xelis Playground",
                description: "Xelis Playground Wallet",
                permissions: PERMISSIONS
            },
            uiOptions: {
                theme: 'xwp-theme'
            }
        }) as XelisWallet;

    _thisApp.xelisWallet.addEventListener("wallet-ready", (_: Event) => {
        _thisApp.rpc_inspector_wallet.xelisWallet = _thisApp.xelisWallet;
        // OPTIONAL. Prefetching permissions avoids wallet popups every time the app requests permissions.
        _thisApp.rpc_inspector_wallet.rpc_url_input.value = `WALLET READY: Address unknown.`;

        const xswd_prefetch = {
            "id": "XSWD_PREFETCH_PERMISSIONS",
            "jsonrpc": "2.0",
            "method": "xswd.prefetch_permissions",
            "params": {
                "reason": "User convenience.",
                "permissions": PERMISSIONS
            }
        };

        if (_thisApp.xelisWallet !== null && _thisApp.xelisWallet.wallet !== null) {
            _thisApp.xelisWallet.wallet.send_query(JSON.stringify(xswd_prefetch));
        }
    });

    _thisApp.xelisWallet.addEventListener("connection-data-received", (e: Event) => {

        const event = e as CustomEvent;

        const response = event.detail.data;
        console.log("Received data from wallet:", response);

        const callMethod = (id: string, method: string) => {
            return {
                "id": id,
                "jsonrpc": "2.0",
                "method": method
            }
        };

        switch (response.id) {
            case "XSWD_PREFETCH_PERMISSIONS": {
                if (response.result) {

                    if (_thisApp.xelisWallet !== null && _thisApp.xelisWallet.wallet !== null) {
                        _thisApp.xelisWallet.wallet.send_query(JSON.stringify(callMethod(`${WalletEndpoint}:schema`, "schema")));
                    }
                }

                if (_thisApp.xelisWallet !== null && _thisApp.xelisWallet.wallet !== null) {
                    _thisApp.xelisWallet.wallet.send_query(JSON.stringify(callMethod(`${WalletEndpoint}:address`, "wallet.get_address")));
                }

                break;
            }

            case `${WalletEndpoint}:schema`: {
                /* this doesn't work at all find out if we can do post-permission requests */

                console.log("RPC Method Schema: ", response.result);

                if(response.error) {
                    _thisApp.rpc_inspector_wallet.rpcLog(`<error><b>Error</b>: ${JSON.stringify(response.error)}</error>`);
                }

                _thisApp.rpc_inspector_wallet.processResponse(response);
                break;
            }

            case `${WalletEndpoint}:address`: {
                _thisApp.rpc_inspector_wallet.rpc_url_input.value = response.result;
                break;
            }

            default: {
                // for now only the rpc inspector needs the account connection
                _thisApp.rpc_inspector_wallet.processResponse(response);
            }
        }

    });

    function resetRPCWalletUI() {
        if(_thisApp.xelisWallet !== null) {
            (_thisApp.xelisWallet as XelisWallet).walletUI.reset();
        }
        // _thisApp.xelisWallet = null;
        // _thisApp.rpc_inspector_wallet.xelisWallet = null;
        _thisApp.rpc_inspector_wallet.rpc_url_input.value = RPCInspector.MSG.NO_WALLET_CONNECTED;
        _thisApp.rpc_inspector_wallet.clearMethodList();
    }

    _thisApp.xelisWallet.addEventListener("wallet-will-disconnect", () => {
        console.log("Wallet disconnecting.");
        resetRPCWalletUI();
    });

    _thisApp.xelisWallet.addEventListener("wallet-disconnect", () => {
        console.log("Wallet disconnected.");
        resetRPCWalletUI();
    });

    _thisApp.xelisWallet.addEventListener("wallet-connect-error", (e: Event) => {
        const error = e as CustomEvent;
        console.error("Wallet connection failed:", error.detail);
        resetRPCWalletUI();
    });
}
