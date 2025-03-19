mod storage;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Mutex,
};

use humantime::format_duration;
use indexmap::IndexMap;
use storage::MockStorage;
use tokio_with_wasm as tokio;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use xelis_builder::EnvironmentBuilder;
use xelis_bytecode::Module;
use xelis_common::{
    block::{Block, BlockHeader, BlockVersion},
    contract::{build_environment, ChainState, ContractCache, ContractEventTracker, ContractProviderWrapper, DeterministicRandom},
    crypto::{elgamal::CompressedPublicKey, Address, Hash, Signature},
    serializer::Serializer,
    utils::format_xelis
};
use xelis_compiler::Compiler;
use xelis_lexer::Lexer;
use xelis_parser::Parser;
use xelis_types::Type;
use xelis_vm::{Primitive, ValueCell, VM};

#[wasm_bindgen]
pub struct Silex {
    environment: EnvironmentBuilder<'static>,
    logs_receiver: mpsc::Receiver<String>,
    is_running: AtomicBool,
}

#[wasm_bindgen]
pub struct Program {
    module: Module,
    entries: Vec<Entry>,
}

#[wasm_bindgen]
impl Program {
    // Get the entries of the program
    pub fn entries(&self) -> Vec<Entry> {
        self.entries.clone()
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        self.module.to_bytes()
    }

    pub fn to_hex(&self) -> String {
        self.module.to_hex()
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Parameter {
    name: String,
    type_name: String,
    ty: Type
}

#[wasm_bindgen]
impl Parameter {
    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn type_name(&self) -> String {
        self.type_name.clone()
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Entry {
    id: usize,
    chunk_id: u16,
    name: String,
    parameters: Vec<Parameter>,
}

#[wasm_bindgen]
impl Entry {
    pub fn id(&self) -> usize {
        self.id
    }

    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn parameters(&self) -> Vec<Parameter> {
        self.parameters.clone()
    }
}

#[wasm_bindgen]
pub struct StorageEntry {
    key: String,
    value: String,
}

#[wasm_bindgen]
impl StorageEntry {
    pub fn key(&self) -> String {
        self.key.clone()
    }

    pub fn value(&self) -> String {
        self.value.clone()
    }
}

#[wasm_bindgen]
pub struct ExecutionResult {
    value: String,
    logs: Vec<String>,
    elapsed_time: String,
    used_gas: u64,
    storage: MockStorage,
}

#[wasm_bindgen]
impl ExecutionResult {
    pub fn value(&self) -> String {
        self.value.clone()
    }

    pub fn logs(&self) -> Vec<String> {
        self.logs.clone()
    }

    pub fn elapsed_time(&self) -> String {
        self.elapsed_time.clone()
    }

    pub fn used_gas(&self) -> u64 {
        self.used_gas
    }

    pub fn used_gas_formatted(&self) -> String {
        format_xelis(self.used_gas)
    }

    pub fn storage(&self) -> Vec<StorageEntry> {
        self.storage
            .data
            .iter()
            .map(|(k, v)| StorageEntry {
                key: format!("{}", k),
                value: format!("{}", v),
            })
            .collect()
    }
}

#[wasm_bindgen]
pub struct Func {
    name: String,
    on_type: Option<String>,
    on_instance: bool,
    return_type: Option<String>,
    params: Vec<String>,
}

#[wasm_bindgen]
impl Func {
    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn on_type(&self) -> Option<String> {
        self.on_type.clone()
    }

    pub fn is_on_instance(&self) -> bool {
        self.on_instance
    }

    pub fn return_type(&self) -> Option<String> {
        self.return_type.clone()
    }

    pub fn params(&self) -> Vec<String> {
        self.params.clone()
    }
}

#[wasm_bindgen]
pub struct ConstFunc {
    name: String,
    for_type: String,
    params: Vec<String>,
}

#[wasm_bindgen]
impl ConstFunc {
    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn for_type(&self) -> String {
        self.for_type.clone()
    }

    pub fn params(&self) -> Vec<String> {
        self.params.clone()
    }
}

static LOGS_SENDER: Mutex<Option<mpsc::Sender<String>>> = Mutex::new(None);

#[wasm_bindgen]
impl Silex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut environment = build_environment::<MockStorage>();
        // Patch the environment to include a println function that sends logs to the receiver
        let (sender, receiver) = mpsc::channel();

        *LOGS_SENDER.lock().unwrap() = Some(sender);
        environment
            .get_mut_function("println", None, vec![Type::Any])
            .set_on_call(move |_, args, _| -> _ {
                let param = &args[0];
                let lock = LOGS_SENDER.lock().unwrap();
                let sender = lock.as_ref().unwrap();
                sender
                    .send(format!("{}", param.as_ref()?))
                    .unwrap();
                Ok(None)
            });

        Self {
            environment,
            logs_receiver: receiver,
            is_running: AtomicBool::new(false),
        }
    }

    fn compile_internal(&self, code: &str) -> anyhow::Result<Program> {
        let tokens = Lexer::new(code)
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;

        let parser = Parser::with(tokens.into_iter(), &self.environment);
        let (program, mapper) = parser.parse().map_err(|err| anyhow::anyhow!("{:#}", err))?;

        // Collect all the available entry functions
        let mut entries = Vec::new();
        let env_offset = self.environment.get_functions().len() as u16;
        for (i, func) in program.functions().iter().enumerate() {
            if func.is_entry() {
                let mapping = mapper
                    .functions()
                    .get_function(&(i as u16 + env_offset))
                    .unwrap();
                let parameters = mapping
                    .parameters
                    .iter()
                    .map(|(name, _type)| Parameter {
                        name: name.to_string(),
                        type_name: Self::type_to_string(&self.environment, _type),
                        ty: _type.clone(),
                    })
                    .collect();

                entries.push(Entry {
                    id: entries.len(),
                    chunk_id: i as u16,
                    name: mapping.name.to_owned(),
                    parameters,
                });
            }
        }

        let compiler = Compiler::new(&program, self.environment.environment());

        Ok(Program {
            module: compiler.compile()?,
            entries,
        })
    }

    // Compile the code
    pub fn compile(&self, code: &str) -> Result<Program, JsValue> {
        match self.compile_internal(code) {
            Ok(program) => Ok(program),
            Err(err) => Err(JsValue::from_str(&format!("{:#}", err))),
        }
    }

    // Check if a program is running
    pub fn has_program_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    fn type_to_string(env: &EnvironmentBuilder, ty: &Type) -> String {
        match ty {
            Type::Opaque(opaque) => env.get_opaque_name(opaque).unwrap().to_string(),
            Type::Struct(ty) => env.get_struct_manager().get_name_by_ref(ty).unwrap().to_string(),
            Type::Enum(ty) => env.get_enum_manager().get_name_by_ref(ty).unwrap().to_string(),
            Type::Array(ty) => format!("{}[]", Self::type_to_string(env, ty)),
            Type::Optional(ty) => format!("optional<{}>", Self::type_to_string(env, ty)),
            _ => ty.to_string(),
        }
    }

    pub fn get_env_functions(&self) -> Vec<Func> {
        let mapper = self.environment.get_functions_mapper();


        let mut funcs = Vec::new();
        for (_t, list) in mapper.get_declared_functions().iter() {
            for f in list.iter() {
                let params: Vec<String> = f.parameters.iter().map(|(name, ty)| 
                    format!("{}: {}", name, Self::type_to_string(&self.environment, &ty))
                ).collect();

                funcs.push(Func {
                    name: f.name.to_string(),
                    on_type: f.on_type.as_ref().map(|v| Self::type_to_string(&self.environment, v)),
                    on_instance: f.require_instance && f.on_type.is_some(),
                    return_type: f.return_type.as_ref().map(|v| Self::type_to_string(&self.environment, v)),
                    params,
                });
            }
        }

        funcs
    }

    pub fn get_constants_functions(&self) -> Vec<ConstFunc> {
        let mut funcs = Vec::new();
        for (for_type, mappings) in self.environment.get_const_functions_mapper().get_mappings() {
            let for_type = Self::type_to_string(&self.environment, for_type);
            for (name, const_fn) in mappings.iter() {
                let params: Vec<String> = const_fn.parameters.iter().map(|(name, ty)| 
                    format!("{}: {}", name, Self::type_to_string(&self.environment, ty))
                ).collect();

                funcs.push(ConstFunc {
                    name: name.to_string(),
                    for_type: for_type.clone(),
                    params,
                });
            }
        }

        funcs
    }

    fn parse_str_to_number<T: std::str::FromStr>(value: Option<String>) -> Result<T, JsValue> {
        value
            .ok_or_else(|| JsValue::from_str("Expected a string value"))?
            .parse::<T>()
            .map_err(|_| JsValue::from_str("Failed to parse the value as a number"))
    }

    fn parse_js_value_to_val(value: JsValue, param: &Type) -> Result<Primitive, JsValue> {
        Ok(match param {
            Type::U8 => Primitive::U8(Self::parse_str_to_number(value.as_string())?),
            Type::U16 => Primitive::U16(Self::parse_str_to_number(value.as_string())?),
            Type::U32 => Primitive::U32(Self::parse_str_to_number(value.as_string())?),
            Type::U64 => Primitive::U64(Self::parse_str_to_number(value.as_string())?),
            Type::U128 => Primitive::U128(Self::parse_str_to_number(value.as_string())?),
            Type::U256 => Primitive::U256(Self::parse_str_to_number(value.as_string())?),
            Type::String => Primitive::String(
                value
                    .as_string()
                    .ok_or_else(|| JsValue::from_str("Expected a string value"))?,
            ),
            Type::Bool => Primitive::Boolean(
                value
                    .as_string()
                    .ok_or_else(|| JsValue::from_str("Expected a string value"))?
                    .parse::<bool>()
                    .map_err(|_| JsValue::from_str("Failed to parse as bool value"))?,
            ),
            Type::Range(inner) => {
                let value = value.as_string().ok_or_else(|| JsValue::from_str("Expected a string value"))?;
                let parts: Vec<&str> = value.split("..").collect();
                if parts.len() != 2 {
                    return Err(JsValue::from_str("Invalid range format"));
                }

                let start = Self::parse_js_value_to_val(JsValue::from_str(parts[0]), inner)?;
                let end = Self::parse_js_value_to_val(JsValue::from_str(parts[1]), inner)?;

                Primitive::Range(Box::new((start, end)))
            },
            _ => {
                return Err(JsValue::from_str(&format!(
                    "Unsupported parameter type parsing: {}",
                    param
                )));
            }
        })
    }

    fn parse_js_value_to_const(&self, value: JsValue, param: &Type) -> Result<ValueCell, JsValue> {
        Ok(match param {
            // TODO: support others types
            Type::Optional(ty) => {
                if value.is_null() || value.is_undefined() || value.as_string().map(|v| v.is_empty()).unwrap_or(false) {
                    Primitive::Null.into()
                } else {
                    self.parse_js_value_to_const(value, ty)?
                }
            },
            Type::Bytes => {
                // TODO: support u8 array
                let value = value.as_string().ok_or_else(|| JsValue::from_str("Expected a string (hex) value"))?;
                let bytes = hex::decode(value).map_err(|_| JsValue::from_str("Failed to parse as blob (hex) value"))?;
                ValueCell::Bytes(bytes)
            },
            Type::Opaque(ty) => {
                let name = self.environment.get_opaque_name(ty)
                    .ok_or_else(|| JsValue::from_str("Failed to get opaque name"))?;

                match name {
                    "Hash" => {
                        let value = value.as_string().ok_or_else(|| JsValue::from_str("Expected a string value"))?;
                        let hash = Hash::from_hex(&value).map_err(|_| JsValue::from_str("Failed to parse as hash value"))?;
                        Primitive::Opaque(hash.into()).into()
                    },
                    "Address" => {
                        let value = value.as_string().ok_or_else(|| JsValue::from_str("Expected a string value"))?;
                        let address = Address::from_string(&value)
                            .map_err(|e| JsValue::from_str(&format!("Failed to parse as address value: {}", e)))?;

                        Primitive::Opaque(address.into()).into()
                    },
                    "Signature" => {
                        let value = value.as_string().ok_or_else(|| JsValue::from_str("Expected a string value"))?;
                        let signature = Signature::from_hex(&value).map_err(|_| JsValue::from_str("Failed to parse as signature value"))?;
                        Primitive::Opaque(signature.into()).into()
                    }
                    _ => return Err(JsValue::from_str(&format!("Unsupported opaque type parsing: {}", name)))
                }
            },
            _ => ValueCell::Default(Self::parse_js_value_to_val(value, param)?)
        })
    }

    // Execute the program
    pub async fn execute_program(
        &self,
        program: Program,
        entry_id: usize,
        max_gas: Option<u64>,
        params: Vec<JsValue>,
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
            values.push(self.parse_js_value_to_const(value, &param.ty)?);
        }

        // Mark it as running
        self.is_running.store(true, Ordering::Relaxed);

        let chunk_id = entry.chunk_id;
        let environment = self.environment.environment().clone();
        let res = tokio::task::spawn_blocking(move || {
            // Fake storage
            // TODO: allow user to configure data in it before running the program
            let mut storage = MockStorage {
                data: Default::default(),
                balances: Default::default(),
            };
            // TODO: configurable
            let deposits = IndexMap::new();
            // TODO: configurable
            let header = BlockHeader::new(BlockVersion::V0, 0, 0, Default::default(), Default::default(), CompressedPublicKey::new(Default::default()), Default::default());
            let block = Block::with(header, Vec::new());
            // TODO: configurable
            let random = DeterministicRandom::new(&Hash::zero(), &Hash::zero(), &Hash::max());

            let zero_hash = Hash::zero();

            let mut chain_state = ChainState {
                debug_mode: true,
                mainnet: false,
                random,
                block: &block,
                contract: &zero_hash,
                block_hash: &zero_hash,
                topoheight: 0,
                tx_hash: &zero_hash,
                deposits: &deposits,
                outputs: Vec::new(),
                cache: ContractCache::new(),
                tracker: ContractEventTracker::default(),
                global_caches: &Default::default()
            };

            let (res, elapsed_time, used_gas) = {
                // Create the VM, this will initialize the context also
                let mut vm = VM::new(&program.module, &environment);

                let context = vm.context_mut();
                context.insert(ContractProviderWrapper(&mut storage));
                context.insert_mut(&mut chain_state);

                if let Some(max_gas) = max_gas {
                    context.set_gas_limit(max_gas);
                }
                context.set_memory_price_per_byte(1);

                vm.invoke_entry_chunk_with_args(chunk_id, values.into_iter().rev())
                    .map_err(|err| format!("{:#}", err))?;

                let start = web_time::Instant::now();
                let res = vm.run();
                let elapsed_time = start.elapsed();
                let used_gas = vm.context().current_gas_usage();

                (res, elapsed_time, used_gas)
            };

            // Merge chain state into mock storage
            let cache = chain_state.cache;
            for (k, (_, v)) in cache.storage.into_iter() {
                match v {
                    Some(v) => storage.data.insert(k, v),
                    None => storage.data.remove(&k),
                };
            }

            match res {
                Ok(value) => Ok(ExecutionResult {
                    value: format!("{}", value),
                    logs: Vec::new(),
                    elapsed_time: format_duration(elapsed_time).to_string(),
                    used_gas,
                    storage,
                }),
                Err(err) => Err(format!("{:#}", err)),
            }
        })
        .await;

        // Mark it as not running
        self.is_running.store(false, Ordering::Relaxed);

        let handle = res.map_err(|err| JsValue::from_str(&format!("{:#}", err)))?;

        // collect all logs
        let logs: Vec<String> = self.logs_receiver.try_iter().collect();

        match handle {
            Ok(mut result) => {
                result.logs = logs;
                Ok(result)
            }
            Err(err) => Err(JsValue::from_str(&err)),
        }
    }
}
