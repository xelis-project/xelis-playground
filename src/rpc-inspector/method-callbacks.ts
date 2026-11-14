import {DaemonEndpoint, EndpointType, WalletEndpoint} from "./types";

const Noop = ()=> {}
export type MethodOptions = {
    pre_response: (() => void),
    post_response: ((response: any) => void),
}

export type MethodOptionsMap = Map<string, MethodOptions>;

const daemon_method_option_map: MethodOptionsMap = new Map<string, MethodOptions>();
const wallet_method_option_map: MethodOptionsMap = new Map<string, MethodOptions>();

const build_transaction_mo: MethodOptions = {
    pre_response: Noop,
    post_response: (response: any) => {
        console.log("BUILD TRANSACTION SUMMARY");
        console.log(response);
    }
}

wallet_method_option_map.set("build_transaction", build_transaction_mo);

export const endpoint_method_option_map: Map<EndpointType, MethodOptionsMap> = new Map<EndpointType, MethodOptionsMap>();
endpoint_method_option_map.set(DaemonEndpoint, daemon_method_option_map);
endpoint_method_option_map.set(WalletEndpoint, wallet_method_option_map)


// function post_response_for_method(endpoint: EndpointType, method_id: number) {
//     const mom = endpoint_method_option_map.get(endpoint);
//
//     if(mom !== null && mom !== undefined) {
//         mom.forEach(method => {
//            +
//         });
//     }
// }




