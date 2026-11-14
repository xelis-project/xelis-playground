//! Isolated contract execution against a simulated chain and storage.
use super::*;

#[wasm_bindgen]
impl Silex {
    pub(super) async fn execute_program_internal(
        &self,
        program: Program,
        entry_id: u16,
        max_gas: Option<u64>,
        deposits: IndexMap<Hash, ContractDeposit>,
        values: Vec<OwnedValue>,
        sp_list: Vec<StoragePreset>,
        run_constructor: bool,
    ) -> Result<ExecutionResult, String> {
        log!(
            "Executing program with entry_id: {}, max_gas: {:?}, values: {:?}",
            entry_id,
            max_gas,
            values
        );

        let environments = self
            .environments
            .iter()
            .map(|(version, env)| (*version, Arc::new(env.environment().clone())))
            .collect::<HashMap<_, _>>();

        let selected_version = program.contract.version;
        tokio::task::spawn_blocking(move || {
            log!("Building storage and chain state");
            // Fake storage
            // TODO: allow user to configure data in it before running the program
            let mut storage = MockStorage {
                data: Default::default(),
                balances: Default::default(),
                assets: [
                    (XELIS_ASSET, (AssetData::new(8, "XELIS".to_owned(), "XEL".to_owned(), MaxSupplyMode::Fixed(MAXIMUM_SUPPLY), AssetOwner::None), 4_000_000 * COIN_VALUE))
                ]
                    .into_iter()
                    .collect(),
            };

            for (hash, amount) in deposits.iter() {
                storage.balances.entry(Hash::zero())
                    .or_default()
                    .insert(hash.clone(), match amount {
                        ContractDeposit::Public(v) => *v,
                        ContractDeposit::Private { .. } => 0,
                    });
            }

            let zero_hash = Hash::zero();
            let contract_cache = storage.data.entry(zero_hash.clone()).or_default();
            for preset in sp_list {
                contract_cache.insert(preset.key, preset.value);
            }

            let global_executions = HashMap::new();
            let transaction = Arc::new(Transaction::new(
                TxVersion::V2,
                CompressedPublicKey::new(Default::default()),
                TransactionType::InvokeContract(InvokeContractPayload {
                    contract: Hash::zero(),
                    deposits: Default::default(),
                    parameters: Vec::new(),
                    entry_id,
                    max_gas: max_gas.unwrap_or(0),
                    permission: InterContractPermission::All,
                }),
                0,
                0,
                0,
                Default::default(),
                {
                    let proof_hex = b"cc15f1b1e654ffd25bb89f4069303245d3c477ce93abb380eb4941096c06000006141de8f618c3392c5071bc3b76467bea32bc0d8fbf9257a3c44a59b596825f9a09332365fffdb56060d4fdfba8a513cbab3f607c0812aefec7124914cf796caa1a4263cdc0d3488e3e6b5bd04d524667e2b49bb8f55cf418fd8af8cd23ef667bd574ab23bf8c71b1bf9a5f52a2ca5a9320bf43a6be8bb2cc864a6745e6de07931382c2b90873b690e7da04b6fd9ddd3f22c060aed621da691bd54e0b6e9f0b3283b6fc7bcaa4ba06a7f3151a49ba5082462b8ba76b93b2934b6c99fe9e730572e026e9a85930896d0120d06115e60cb68bc6bd18335288ca01f8591924da7e563ac102237e476357b37ecd834715272c5eb705c5bc3799602d922cfa153665565926daf7df42276e834afe1fa444fabf17e7596f09936bcc27f913053fac3906ce8a10dbe1caf1c1e02428d8f2773fc307ae7c7d2fe63102e605c89efa730a4e217dd6b2481f49803efdc44b25d80236e0c10ecab006136ba423ec75bbf7532286a1d063e16e13903104e8274666169288cb9f65a414a04e3dacb7d368931e647a149554f3c78e326e111e5da221cb4e8152d3525f0b32ff2b814b7352647674f1a36e49f8603e3d3996910f52154b871c72138e288b00b471026638646f201c0c0b358872fa6bc81a2ce1c2f068b4513828eda4def4ae1c2e9c02ef58043412dd31411c5cec7acd9bfdcf5f8ead03f13801bc4bc529726e6b25f85b80db23fc8659a09b8c590a51ec015065d437e77d84b0d3c3d529d1c6301441d2dd335042f64b1ced343c32b25416bd5d43e4ff02d4382cc18f1f5cfc0144decc51ac0d9863f1124589ec6f0fe388b464db7db4d5f16ff101da37a3efed71a4d4514915eccc94dc7832bf4c0b52165ac937e5b0dff2d0a2e7b68802a8759e4bae58815f6e2ec7683006561f27f1855ad8840036c580c81ebadf36ddfdf7470996068c05f186a67cefb751e33b5624d577357372486bae3fd509aea9b6d4c72296afdd05";
                    RangeProof::from_bytes(&hex::decode(proof_hex).unwrap()).unwrap()
                },
                Reference {
                    hash: Hash::zero(),
                    topoheight: 0
                },
                None,
                Signature::new(Default::default(), Default::default())
            ));

            // TODO: configurable
            let header = BlockHeader::new(
                BlockVersion::V7,
                0,
                0,
                Immutable::Owned(Default::default()),
                Default::default(),
                CompressedPublicKey::new(Default::default()),
                Default::default()
            );
            let block = Block::new(header, Vec::new());
            let metadata = ContractMetadata {
                contract_executor: zero_hash.clone(),
                contract_caller: None,
                deposits: deposits.clone(),
                contract_version: selected_version,
            };
            let global_modules = HashMap::new();

            let mut chain_state = ChainState {
                global_modules: &global_modules,
                log_level: log::Level::Debug,
                mainnet: false,
                block: &block,
                entry_contract: Cow::Borrowed(&zero_hash),
                block_hash: &zero_hash,
                topoheight: 0,
                environments: Cow::Borrowed(&environments),
                // TODO: configurable
                caller: ContractCaller::Transaction(&zero_hash, &transaction),
                global_caches: &Default::default(),
                injected_gas: Default::default(),
                executions: ExecutionsManager {
                    allow_executions: true,
                    global_executions: &global_executions,
                    changes: ExecutionsChanges::default(),
                },
                changes: Default::default(),
                logs: Default::default(),
                loaded_modules: Default::default(),
                // For playground, we allow everything
                permission: Cow::Owned(InterContractPermission::All),
                gas_fee_allowance: 0,
                block_version: BlockVersion::V7,
            };

            let environment = &environments[&selected_version];
            let mut logs = Vec::new();
            let (res, elapsed_time, used_gas, used_memory) = {
                let mut vm = VM::default();
                vm.append_module(ModuleMetadata {
                    module: program.contract.module.clone().into(),
                    environment: environment.clone().into(),
                    metadata: (&metadata).into(),
                }).map_err(|e| format!("Error while adding module: {}", e))?;

                let context = vm.context_mut();
                context.insert(ExecutionLogs::default());
                context.insert_ref(&storage);
                context.insert_mut(&mut chain_state);

                if let Some(max_gas) = max_gas {
                    context.set_gas_limit(max_gas);
                }
                context.set_memory_price_per_byte(1);

                let constructor = if run_constructor {
                    vm.invoke_hook_id(0)
                        .map_err(|err| format!("{:#}", err))?
                } else {
                    false
                };

                let start = web_time::Instant::now();
                if constructor {
                    logs.push("Executing constructor..".to_owned());
                    log!("Executing constructor..");

                    let res = vm.run_blocking()
                        .map_err(|err| format!("constructor: {:#}", err))?;

                    if res != OwnedValue::Primitive(Primitive::Integer(PrimitiveInteger::U64(0))) {
                        return Err(format!("Constructor returned a non-zero exit code: {:#}", res));
                    }

                    // VM has consumed the module, lets re-inject it again
                    vm.append_module(ModuleMetadata {
                        module: program.contract.module.clone().into(),
                        environment: environment.clone().into(),
                        metadata: (&metadata).into(),
                    }).map_err(|e| format!("Error while re-adding module: {}", e))?;
                }

                log!("Executing entry point with ID: {}", entry_id);
                vm.invoke_chunk_with_args(entry_id, values.into_iter())
                    .map_err(|err| format!("{:#}", err))?;

                log!("Running VM");
                let res = vm.run_blocking();
                log!("VM executed");

                let elapsed_time = start.elapsed();
                let context = vm.context_mut();
                logs.extend(context.take::<ExecutionLogs>().unwrap_or_default().0);
                let used_gas = context.current_gas_usage();
                let used_memory = context.current_memory_usage();

                (res, elapsed_time, used_gas, used_memory as u64)
            };

            log!("Execution completed in {} ms, used gas: {}, used memory: {} bytes", elapsed_time.as_millis(), used_gas, used_memory);

            // Merge chain state into mock storage
            let caches = chain_state.changes.caches;
            let mut events = HashMap::new();

            for (contract, cache) in caches.into_iter() {
                let contract_cache = storage.data.entry(contract.clone()).or_default();
                for (k, v) in cache.storage.into_iter() {
                    match v {
                        Some((_, Some(v))) => {
                            contract_cache.insert(k, v);
                        },
                        Some((_, None)) => {
                            contract_cache.remove(&k);
                        },
                        None => {}, // key stored as checked but not found
                    };
                }

                events.insert(contract, cache.events);
            }

            for event in chain_state.changes.events {
                events.entry(event.contract).or_default().entry(event.event_id)
                    .or_default().push(OwnedValue::Object(event.params));
            }

            let res = ExecutionResult {
                value: match res {
                    Ok(value) => Ok(value),
                    Err(err) => Err(format!("{:#}", err)),
                },
                logs,
                elapsed_time: format_duration(elapsed_time).to_string(),
                used_gas,
                used_memory,
                storage,
                events,
            };

            Ok(res)
        }).await.map_err(|v| v.to_string())?
    }

    // Execute the program
    pub async fn execute_program(
        &self,
        program: Program,
        entry_id: usize,
        max_gas: Option<u64>,
        params: Vec<JsValue>,
        storage_presets: Vec<JsValue>,
        deposits_js: JsValue,
        run_constructor: bool,
    ) -> Result<ExecutionResult, JsValue> {
        if self.has_program_running() {
            return Err(JsValue::from_str("A program is already running"));
        }

        let entry = program
            .entries
            .get(entry_id)
            .ok_or_else(|| JsValue::from_str("Invalid entry point"))?;

        if entry.parameters.len() != params.len() {
            return Err(JsValue::from_str("Invalid number of parameters"));
        }

        let mut values = Vec::with_capacity(params.len());
        for (value, param) in params.into_iter().zip(entry.parameters.iter()) {
            let p = &param.ty;
            values.push(self.parse_js_value_to_const(value, p)?);
        }

        let mut sp_list: Vec<StoragePreset> = Vec::with_capacity(storage_presets.len());

        for preset in storage_presets {
            sp_list.push(self.js_to_storage_preset(preset)?);
        }

        // Parse deposits from JavaScript object
        let mut deposits: IndexMap<Hash, ContractDeposit> = IndexMap::new();
        if !deposits_js.is_null() && !deposits_js.is_undefined() {
            // Deserialize the JS object as a HashMap
            let deposits_map: HashMap<String, String> = serde_wasm_bindgen::from_value(deposits_js)
                .map_err(|e| JsValue::from_str(&format!("Failed to parse deposits: {:?}", e)))?;

            for (hash_str, amount_str) in deposits_map {
                let hash = Hash::from_hex(&hash_str)
                    .map_err(|e| JsValue::from_str(&format!("Invalid hash format: {}", e)))?;
                let amount = amount_str
                    .parse::<u64>()
                    .map_err(|e| JsValue::from_str(&format!("Invalid amount: {}", e)))?;

                deposits.insert(hash, ContractDeposit::Public(amount));
            }
        }

        // Mark it as running
        self.is_running.store(true, Ordering::Relaxed);

        let chunk_id = entry.chunk_id;
        let handle = self
            .execute_program_internal(
                program,
                chunk_id,
                max_gas,
                deposits,
                values,
                sp_list,
                run_constructor,
            )
            .await
            .map_err(|err| JsValue::from_str(&format!("{:#}", err)));

        // Mark it as not running
        self.is_running.store(false, Ordering::Relaxed);

        handle
    }
}
