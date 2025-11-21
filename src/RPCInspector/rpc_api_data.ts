
export type RPCMethod = string;
export type RPCParams = string;


const daemon_api = new Map<RPCMethod, RPCParams>([
    ["get_height", ""],
    ["get_topoheight", ""],
    ["get_pruned_topoheight", ""],
    ["get_info", ""],
    ["get_difficulty", ""],
    ["get_tips", ""],
    ["get_dev_fee_thresholds", ""],
    ["get_size_on_disk", ""],

// Retro compatibility, use stable_height
    ["get_stableheight", ""],
    ["get_stable_height", ""],
    ["get_stable_topoheight", ""],
    ["get_hard_forks", ""],

// Blocks
//["get_block_at_topoheight", "{}"]]);
    ["get_blocks_at_height", `{ "height": <required>[INTEGER]</required>}`],
    ["get_block_by_hash", `{"hash": "<required>[HASH]</required>", "include_txs": <optional>[true|false]</optional>}`],
    ["get_top_block", `{"include_txs": <optional>[true|false]</optional>}`],
    ["get_block_difficulty_by_hash", `{"block_hash": "<required>[HASH]</required>"}`],
    ["get_block_base_fee_by_hash", `{"block_hash": "<required>[HASH]</required>"}`],
    ["get_block_summary_at_topoheight", `{"topoheight": <required>[INTEGER]</required>, "include_txs": <optional>[true|false]</optional>}`],

// Balances
    ["get_balance", `{"address": "<required>[ADDRESS]</required>", "asset": "<required>[ASSET]</required>"}`],
    ["get_stable_balance", `{"address": "<required>[ADDRESS]</required>", "asset": "<required>[ASSET]</required>"}`],
    ["has_balance", `{"address": "<required>[ADDRESS]</required>", "asset": "<required>[ASSET]</required>"}`],
    ["get_balance_at_topoheight", `{"address": "<required>[ADDRESS]</required>", "asset": "<required>[ASSET]</required>"}, "topoheight": <required>[INTEGER]</required>}`],

    ["get_nonce", `{"address": "<required>[ADDRESS]</required>", "topoheight": <optional>[INTEGER]</optional>}`],
    ["has_nonce", `{"address": "<required>[ADDRESS]</required>", "topoheight": <optional>[INTEGER]</optional>}`],
    ["get_nonce_at_topoheight", `{"address": "<required>[ADDRESS]</required>", "topoheight": <optional>[INTEGER]</optional>}`],

// Assets
    ["get_asset", `{"asset": "<required>[ASSET]</required>"}`],
    ["get_asset_supply", `{"asset": "<required>[ASSET]</required>"}`],
    ["get_assets", `{"skip": <optional>[INTEGER]</optional>, "maximum": <optional>[INTEGER]</optional>}`],

    ["count_assets", ""],
    ["count_accounts", ""],
    ["count_transactions", ""],
    ["count_contracts", ""],

// Transactions
    ["submit_transaction", `{"data": "<required>[TX_HEX]</required>"}`],
    ["get_transaction_executor", `{"hash": "<required>[TX_HASH]</required>"}`],
    ["get_transaction", `{"hash": "<required>[TX_HASH]</required>"}`],
    ["get_transactions", `{"tx_hashes": [<required>"[TX_HASH1]", "[TX_HASH2]" ...</required>]}`],
    ["get_transactions_summary", `{"tx_hashes": ["<required>HASH1</required>", "<required>HASH2</required>", ...]}`],
    ["is_tx_executed_in_block", `{"tx_hash": "<required>[HASH]</required>", "block_hash": "<required>[HASH]</required>"}`],

// P2p
    ["p2p_status", ""],
    ["get_peers", ""],
    ["get_p2p_block_propagation", `{"hash": "<required>[HASH]</required>", "outgoing": <optional>true</optional>, "incoming": <optional>true</optional>}`],

// Mempool
    ["get_mempool", `{"skip": <optional>[INTEGER]</optional>, "maximum": <optional>[INTEGER]</optional>}`],
    ["get_mempool_summary", `{"skip": <optional>[INTEGER]</optional>, "maximum": <optional>[INTEGER]</optional>}`],
    ["get_mempool_cache", `{"address": <required>[ADDRESS]</required>}`],
    ["get_estimated_fee_rates", ""],
    ["get_estimated_fee_per_kb", ""],

// DAG
    ["get_dag_order", `{"start_topoheight": <optional>[INTEGER]</optional>, "end_topoheight": <optional>[INTEGER]</optional>}`],
    ["get_blocks_range_by_topoheight", `{"start_topoheight": <optional>[INTEGER]</optional>, "end_topoheight": <optional>[INTEGER]</optional>}`],
    ["get_blocks_range_by_height", `{"start_height": <optional>[INTEGER]</optional>, "end_height": <optional>[INTEGER]</optional>}`],

// Accounts
    ["get_account_history", `{"address": "<required>[ADDRESS]</required>", 
                                "hash": "<optional>[HASH]</optional>",
                                "minimum_topoheight": <optional>[INTEGER]</optional>,
                                "maximum_topoheight": <optional>[INTEGER]</optional>,
                                "outgoing_flow": <optional>[BOOLEAN]</optional>,
                                "incoming_flow": <optional>[BOOLEAN]</optional>
                                }`],
    ["get_account_assets", `{"address": "<required>[ADDRESS]</required>",
                                "skip": <optional>[INTEGER]</optional>,
                                "maximum": <optional>[INTEGER]</optional>
                                }`],
    ["get_accounts", `{"skip": <optional>[INTEGER]</optional>,
                                "maximum": <optional>[INTEGER]</optional>,
                                "minimum_topoheight": <optional>[INTEGER]</optional>,
                                "maximum_topoheight": <optional>[INTEGER]</optional>
                                }`],
    ["is_account_registered", `{"address": "<required>[ADDRESS]</required>", 
                                "in_stable_height": <required>[BOOLEAN]</required>
                                }`],
    ["get_account_registration_topoheight", `{"address": "<required>[ADDRESS]</required>"}`],

// Useful methods
    ["validate_address", `{"address": "<required>[ADDRESS]</required>", 
                                "allow_integrated": <required>[BOOLEAN]</required>
                                }`],
    ["split_address", `{"address": "<required>[ADDRESS]</required>"}`],
    ["extract_key_from_address", `{"address": "<required>[ADDRESS]</required>", 
                                "as_hex": <optional>[BOOLEAN]</optional>
                                }`],
    ["key_to_address", "{}"],
    ["make_integrated_address", `{"address": "<required>[ADDRESS]</required>", 
                                "integrated_data": <required>[JSON]</required>
                                }`],
    ["decrypt_extra_data", `{"shared_key": "<required>[HEXADECIMAL]</required>", 
                                "extra_data": <required>[BYTE_ARRAY]</required>
                                }`],

// Multisig
    ["get_multisig_at_topoheight", `{"address": "<required>[ADDRESS]</required>", 
                                "topoheight": <required>[INTEGER]</required>
                                }`],
    ["get_multisig", `{"address": "<required>[ADDRESS]</required>"}`],
    ["has_multisig", `{"address": "<required>[ADDRESS]</required>"}`],
    ["has_multisig_at_topoheight", `{"address": "<required>[ADDRESS]</required>", 
                                "topoheight": <required>[INTEGER]</required>
                                }`],

// Contracts
    ["get_contract_logs", `{"caller": "<required>[TC_HASH]</required>"}`],
    ["get_contract_scheduled_executions_at_topoheight", `{"topoheight": <required>[INTEGER]</required>
                                "max": <optional>[INTEGER]</optional>
                                "skip": <optional>[INTEGER]</optional>
                                }`],
    ["get_contract_registered_executions_at_topoheight",  `{"topoheight": <required>[INTEGER]</required>
                                "max": <optional>[INTEGER]</optional>
                                "skip": <optional>[INTEGER]</optional>
                                }`],

    ["get_contract_outputs", `{"shared_key": "<required>[HEXADECIMAL]</required>", 
                                "extra_data": <required>[BYTE_ARRAY]</required>
                                }`],
    ["get_contract_module", `{"contract": "<required>[HASH]</required>"}`],
    ["get_contract_data", `{"contract": "<required>[HASH]</required>", 
                                "key": <required>[VALUE_CELL]</required>
                                }`],
    ["get_contract_data_at_topoheight", `{"contract": "<required>[HASH]</required>", 
                                "key": <required>[VALUE_CELL]</required>,
                                "topoheight": <required>[INTEGER]</required>
                                }`],
    ["get_contract_balance", `{"contract": "<required>[HASH]</required>", 
                                "asset": <required>[VALUE_CELL]</required>
                                }`],
    ["get_contract_balance_at_topoheight", `{"contract": "<required>[HASH]</required>", 
                                "asset": <required>[VALUE_CELL]</required>,
                                "topoheight": <required>[INTEGER]</required>
                                }`],
    ["get_contract_assets", `{"contract": "<required>[HASH]</required>",
                                "skip": <optional>[INTEGER]</optional>,
                                "maximum": <optional>[INTEGER]</optional>
                                }`],
    ["get_contracts", `{"skip": <optional>[INTEGER]</optional>,
                                "maximum": <optional>[INTEGER]</optional>,
                                "minimum_topoheight": <optional>[INTEGER]</optional>,
                                "maximum_topoheight": <optional>[INTEGER]</optional>
                                }`],
    ["get_contract_data_entries", `{"contract": "<required>[HASH]</required>",
                                "minimum_topoheight": <optional>[INTEGER]</optional>,
                                "maximum_topoheight": <optional>[INTEGER]</optional>,
                                "skip": <optional>[INTEGER]</optional>,
                                "maximum": <optional>[INTEGER]</optional>
                                }`],
    ["get_block_template", `{"address": "<required>[ADDRESS]</required>"}`],
    ["get_miner_work", `{"template": "<required>[BLOCKTEMPLATE]</required>", 
                                "address": <optional>[ADDRESS]</optional>
                                }`],
    ["submit_block", `{"block_template": "<required>[STRING]</required>", 
                                "miner_work": <optional>[STRING]</optional>
                                }`],
]);

const wallet_api = new Map<RPCMethod, RPCParams>([
    ["get_version", ""],
    ["get_network", ""],
    ["get_nonce", ""],
    ["get_topoheight", ""],
    ["get_address", `{"integrated_data": <required>[JSON]</required>}`],
    ["split_address", `{"address": "<required>[ADDRESS]</required>"}`],
    ["rescan", `{"until_topoheight": "<required>[INTEGER]</required>"}`],
    ["get_balance", `{"asset": "<optional>[HASH]</optional>"}`],
    ["has_balance", `{"asset": "<optional>[HASH]</optional>"}`],
    ["get_tracked_assets", "{}"],
    ["is_asset_tracked", "{}"],
    ["track_asset", "{}"],
    ["untrack_asset", "{}"],
    ["get_asset_precision", "{}"],
    ["get_assets", "{}"],
    ["get_asset", "{}"],
    ["get_transaction", "{}"],
    ["search_transaction", "{}"],
    ["dump_transaction", "{}"],
    ["build_transaction", "{}"],
    ["build_transaction_offline", "{}"],
    ["build_unsigned_transaction", "{}"],
    ["finalize_unsigned_transaction", "{}"],
    ["sign_unsigned_transaction", "{}"],

    ["clear_tx_cache", ""],
    ["list_transactions", "{}"],
    ["is_online", ""],
    ["set_online_mode", "{}"],
    ["set_offline_mode", ""],
    ["sign_data", "{}"],
    ["estimate_fees", "{}"],
    ["estimate_extra_data_size", "{}"],
    ["network_info", ""],
    ["decrypt_extra_data", "{}"],
    ["decrypt_ciphertext", "{}"],

    // Encrypted DB
    ["get_matching_keys", "{}"],
    ["count_matching_entries", "{}"],
    ["get_value_from_key", "{}"],
    ["store", "{}"],
    ["delete", "{}"],
    ["delete_tree_entries", "{}"],
    ["has_key", "{}"],
    ["query_db", "{}"]
]);

export const rpc_api_data: Map<string, Map<RPCMethod, RPCParams>> = new Map([["daemon", daemon_api], ["wallet", wallet_api]]);