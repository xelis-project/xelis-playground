mod storage;

use std::{borrow::Cow, collections::HashMap, sync::{
    atomic::{AtomicBool, Ordering}, mpsc, Arc, Mutex
}};

use cfg_if::cfg_if;
use human_bytes::human_bytes;
use humantime::format_duration;
use indexmap::IndexMap;
use storage::MockStorage;
#[cfg(all(
    target_arch = "wasm32",
    target_vendor = "unknown",
    target_os = "unknown"
))]
use tokio_with_wasm as tokio;

use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use xelis_assembler::Disassembler;
use xelis_builder::{Builder, EnvironmentBuilder};
use xelis_bytecode::Module;
use xelis_common::{
    block::{Block, BlockHeader, BlockVersion},
    contract::{
        ChainState,
        ContractEventTracker,
        ContractMetadata,
        ContractProviderWrapper,
        InterContractPermission,
        ModuleMetadata,
        build_environment,
        vm::ContractCaller
    },
    crypto::{
        Address,
        Hash,
        Signature,
        elgamal::CompressedPublicKey,
        proofs::RangeProof
    },
    immutable::Immutable,
    serializer::Serializer,
    transaction::{
        ContractDeposit,
        InvokeContractPayload,
        Reference,
        Transaction,
        TransactionType,
        TxVersion
    },
    utils::format_xelis
};
use xelis_compiler::Compiler;
use xelis_lexer::Lexer;
use xelis_parser::Parser;
use xelis_types::Type;
use xelis_vm::{Context, FnInstance, FnParams, FnReturnType, FunctionHandler, Primitive, SysCallResult, VM, ValueCell};
use serde::Deserialize;

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console, js_name = log)]
  pub fn console_log(s: &str);
}

macro_rules! log {
    ($($t:tt)*) => {{
        cfg_if! {
            if #[cfg(target_arch = "wasm32")] {
                console_log(&format!($($t)*));
            } else {
                println!($($t)*);
            }
        }
    }};
}

#[wasm_bindgen]
pub struct Silex {
    environment: EnvironmentBuilder<'static, ContractMetadata>,
    logs_receiver: mpsc::Receiver<String>,
    is_running: AtomicBool,
}

#[wasm_bindgen]
pub struct Program {
    module: Module,
    entries: Vec<Entry>,
    abi: String,
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

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(&self.module)
            .expect("Failed to serialize module to JSON")
    }

    pub fn to_abi(&self) -> String {
        self.abi.clone()
    }

    pub fn to_asm(&self) -> String {
        let mut disassembler = Disassembler::new(&self.module);
        disassembler.disasemble()
            .expect("Failed to disassemble the module")
            .to_string()
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Parameter {
    name: String,
    ty: Type
}

#[wasm_bindgen]
impl Parameter {
    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn type_json(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.ty)
            .expect("Expected valid serialization")
    }

    pub fn type_name(&self) -> String {
        self.ty.to_string()
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
    used_memory: u64,
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

    pub fn used_memory(&self) -> u64 {
        self.used_memory
    }

    pub fn used_memory_formatted(&self) -> String {
        human_bytes(self.used_memory as f64)
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
    syscall_id: u16,
    cost: u64,
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

    pub fn syscall_id(&self) -> u16 {
        self.syscall_id
    }

    pub fn gas_cost_formatted(&self) -> String {
        format_xelis(self.cost)
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
#[derive(Deserialize, Debug, Clone)]
pub struct StoragePresetJSON {
    key_type_id: u8,
    key: String,
    value_type_id: u8,
    value: String,
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct StoragePreset {
    key: ValueCell,
    value: ValueCell,
}

#[wasm_bindgen]
impl Silex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        log!("Initializing Silex...");
        let mut environment = build_environment::<MockStorage>();
        // Patch the environment to include a println function that sends logs to the receiver
        let (sender, receiver) = mpsc::channel();

        *LOGS_SENDER.lock().unwrap() = Some(sender);

        log!("Setting up environment functions...");
        environment
            .get_mut_function("println", None)
            .set_on_call(FunctionHandler::Sync(Self::println_fn));

        Self {
            environment,
            logs_receiver: receiver,
            is_running: AtomicBool::new(false),
        }
    }

    fn println_fn(_: FnInstance, params: FnParams, _: &ModuleMetadata, _: &mut Context) -> FnReturnType<ContractMetadata> {
        let param = &params[0];
        cfg_if! {
            if #[cfg(target_arch = "wasm32")] {
                let lock = LOGS_SENDER.lock().unwrap();
                let sender = lock.as_ref().unwrap();
                sender
                    .send(format!("{}", param.as_ref()))
                    .unwrap();
            } else {
                println!("{}", param.as_ref());
            }
        }

        Ok(SysCallResult::None)
    }

    fn compile_internal(&self, code: &str) -> anyhow::Result<Program> {
        log!("Compiling code:\n{}", code);
        let tokens = Lexer::new(code)
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;

        let parser = Parser::with(tokens.into_iter(), &self.environment);
        let (program, mapper) = match parser.parse() {
            Ok(res) => res,
            Err(mut err) => {
                // Adjust to editor coordinates (1-based)
                err.line += 1;
                err.column_start += 1;
                err.column_end += 1;

                log!("Parser error: {:#}", err);
                return Err(anyhow::anyhow!("{:#}", err));
            }
        };

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

        log!("Found {} entry points", entries.len());
        let compiler = Compiler::new(&program, self.environment.environment());
        let module = compiler.compile()?;

        log!("Compiled module");
        let abi = xelis_abi::abi_from_parse(&program, &mapper, &self.environment)
          .unwrap_or_else(|err| format!("{{\"error\": \"{}\"}}", err));

        Ok(Program {
            module,
            entries,
            abi,
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

    pub fn get_env_functions(&self) -> Vec<Func> {
        let mapper = self.environment.get_functions_mapper();
        let mut funcs = Vec::new();

        for (_t, list) in mapper.get_declared_functions() {
            for (f, syscall_id) in list {
                let params: Vec<String> = f.parameters.iter().map(|(name, ty)| 
                    format!("{}: {}", name, ty)
                ).collect();

                funcs.push(Func {
                    name: f.name.to_string(),
                    on_type: f.on_type.as_ref().map(Type::to_string),
                    on_instance: f.require_instance && f.on_type.is_some(),
                    return_type: f.return_type.as_ref().map(Type::to_string),
                    params,
                    syscall_id,
                    cost: f.cost
                });
            }
        }

        funcs
    }

    pub fn get_declared_types(&self) -> Vec<String> {
        let mut types = Vec::new();
        for ty in self.environment.get_struct_manager().iter() {
            let t = ty.get_type();
            types.push(format!("struct {} {{ {} }}", t.name(), t.fields()
                .iter()
                .map(|(n, ty)| format!("{}: {}", n, ty))
                .collect::<Vec<_>>()
                .join(", "))
            );
        }

        for ty in self.environment.get_enum_manager().iter() {
            let t = ty.get_type();
            // enum Name { Variant1: { field1: Type1, field2: Type2 }, Variant2: { field1: Type1 } }
            types.push(format!("enum {} {{\n    {}\n}}", t.name(), t.variants()
                .iter()
                .map(|(variant_name, ty)| {
                    let fields = ty.fields()
                        .as_ref()
                        .iter()
                        .map(|(field_name, field_type)| format!("{}: {}", field_name, field_type))
                        .collect::<Vec<_>>()
                        .join(",\n");

                    // { field1: Type1, field2: Type2 }
                    // if no fields, then just Variant1
                    if fields.is_empty() {
                        return variant_name.to_string();
                    }

                    format!("   {} {{\n    {}\n   }}", variant_name, fields)
                })
                .collect::<Vec<_>>()
                .join(",\n"))
            );
        }

        for ty in self.environment.get_opaque_manager().iter() {
            types.push(format!("opaque {};", ty.name()));
        }

        types
    }

    pub fn get_constants_functions(&self) -> Vec<ConstFunc> {
        let mut funcs = Vec::new();
        for (for_type, mappings) in self.environment.get_const_functions_mapper().get_mappings() {
            for (name, const_fn) in mappings.iter() {
                let params: Vec<String> = const_fn.parameters.iter().map(|(name, ty)| 
                    format!("{}: {}", name, ty)
                ).collect();

                funcs.push(ConstFunc {
                    name: name.to_string(),
                    for_type: for_type.to_string(),
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
            _ => ValueCell::Primitive(Self::parse_js_value_to_val(value, param)?)
        })
    }

    pub fn js_to_storage_preset(&self, js_value: JsValue) -> Result<StoragePreset, JsValue> {
        let storage_preset_json: Result<StoragePresetJSON, serde_wasm_bindgen::Error> = serde_wasm_bindgen::from_value(js_value);
        match storage_preset_json {
            Ok(sp_json) => {
                let Some(key_type) = Type::primitive_type_from_byte(sp_json.key_type_id) else {
                    return Err(JsValue::from_str("Invalid key type"));
                };

                let Some(value_type) = Type::primitive_type_from_byte(sp_json.value_type_id) else {
                    return Err(JsValue::from_str("Invalid value type"));
                };

                let storage_key = self.parse_js_value_to_const(JsValue::from_str(sp_json.key.as_str()), &key_type)?;
                let storage_value = self.parse_js_value_to_const(JsValue::from_str(sp_json.value.as_str()), &value_type)?;

                let sp = StoragePreset {
                    key: storage_key,
                    value: storage_value,
                };

                Ok(sp)
            }
            Err(err) => Err(JsValue::from_str(format!("Failed to parse storage preset: {}", err).as_str())),
        }
    }

    async fn execute_program_internal(
        &self,
        program: Program,
        entry_id: u16,
        max_gas: Option<u64>,
        deposits: IndexMap<Hash, ContractDeposit>,
        values: Vec<ValueCell>,
        sp_list: Vec<StoragePreset>,
    ) -> Result<ExecutionResult, String> {
        log!("Executing program with entry_id: {}, max_gas: {:?}, values: {:?}", entry_id, max_gas, values);
        let environment = self.environment.environment().clone();
        tokio::task::spawn_blocking(move || {
            log!("Building storage and chain state");
            // Fake storage
            // TODO: allow user to configure data in it before running the program
            let mut storage = MockStorage {
                data: Default::default(),
                balances: Default::default(),
            };

            for preset in sp_list {
                storage.data.insert(preset.key, preset.value);
            }

            let transaction = Arc::new(Transaction::new(
                TxVersion::V0,
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
                BlockVersion::V0,
                0,
                0,
                Immutable::Owned(Default::default()),
                Default::default(),
                CompressedPublicKey::new(Default::default()),
                Default::default()
            );
            let block = Block::new(header, Vec::new());
            let zero_hash = Hash::zero();
            let metadata = ContractMetadata {
                contract_executor: zero_hash.clone(),
                contract_caller: None,
                deposits: deposits.clone(),
            };

            let mut chain_state = ChainState {
                debug_mode: true,
                mainnet: false,
                block: &block,
                entry_contract: Cow::Borrowed(&zero_hash),
                block_hash: &zero_hash,
                topoheight: 0,
                // TODO: configurable
                caller: ContractCaller::Transaction(&zero_hash, &transaction),
                modules: HashMap::new(),
                outputs: Vec::new(),
                caches: HashMap::new(),
                tracker: ContractEventTracker::default(),
                assets: Default::default(),
                global_caches: &Default::default(),
                injected_gas: Default::default(),
                executions_topoheight: Default::default(),
                executions_block_end: Default::default(),
                allow_executions: true,
                // For playground, we allow everything
                permission: Cow::Owned(InterContractPermission::All),
            };

            let mut logs = Vec::new();
            let (res, elapsed_time, used_gas, used_memory) = {
                let mut vm = VM::default();
                vm.append_module(ModuleMetadata {
                    module: (&program.module).into(),
                    environment: (&environment).into(),
                    metadata: (&metadata).into(),
                }).map_err(|e| format!("Error while adding module: {}", e))?;

                let context = vm.context_mut();
                context.insert(ContractProviderWrapper(&mut storage));
                context.insert_mut(&mut chain_state);

                if let Some(max_gas) = max_gas {
                    context.set_gas_limit(max_gas);
                }
                context.set_memory_price_per_byte(1);

                let constructor = vm.invoke_hook_id(0)
                    .map_err(|err| format!("{:#}", err))?;

                let start = web_time::Instant::now();
                if constructor {
                    logs.push("Executing constructor..".to_owned());
                    log!("Executing constructor..");

                    let res = vm.run_blocking()
                        .map_err(|err| format!("constructor: {:#}", err))?;

                    if res != ValueCell::Primitive(Primitive::U64(0)) {
                        return Err(format!("Constructor returned a non-zero exit code: {:#}", res));
                    }

                    // VM has consumed the module, lets re-inject it again
                    vm.append_module(ModuleMetadata {
                        module: (&program.module).into(),
                        environment: (&environment).into(),
                        metadata: (&metadata).into(),
                    }).map_err(|e| format!("Error while re-adding module: {}", e))?;
                }

                log!("Executing entry point with ID: {}", entry_id);
                vm.invoke_entry_chunk_with_args(entry_id, values.into_iter().rev())
                    .map_err(|err| format!("{:#}", err))?;

                log!("Running VM");
                let res = vm.run_blocking();
                log!("VM executed");

                let elapsed_time = start.elapsed();
                let context = vm.context();
                let used_gas = context.current_gas_usage();
                let used_memory = context.current_memory_usage();

                (res, elapsed_time, used_gas, used_memory as u64)
            };

            log!("Execution completed in {} ms, used gas: {}, used memory: {} bytes", elapsed_time.as_millis(), used_gas, used_memory);

            // Merge chain state into mock storage
            let mut caches = chain_state.caches;
            if let Some(cache) = caches.remove(&zero_hash) {
                for (k, v) in cache.storage.into_iter() {
                    match v {
                        Some((_, Some(v))) => {
                            storage.data.insert(k, v);
                        },
                        Some((_, None)) => {
                            storage.data.remove(&k);
                        },
                        None => {}, // key stored as checked but not found
                    };
                }
            }

            match res {
                Ok(value) => Ok(ExecutionResult {
                    value: format!("{}", value),
                    logs,
                    elapsed_time: format_duration(elapsed_time).to_string(),
                    used_gas,
                    used_memory,
                    storage,
                }),
                Err(err) => Err(format!("{:#}", err)),
            }
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

        // Mark it as running
        self.is_running.store(true, Ordering::Relaxed);

        let chunk_id = entry.chunk_id;
        // TODO: support deposits configuration
        let handle = self.execute_program_internal(program, chunk_id, max_gas, Default::default(), values, sp_list).await
            .map_err(|err| JsValue::from_str(&format!("{:#}", err)));

        // Mark it as not running
        self.is_running.store(false, Ordering::Relaxed);

        // collect all logs
        let logs: Vec<String> = self.logs_receiver.try_iter().collect();

        match handle {
            Ok(mut result) => {
                result.logs.extend(logs);
                Ok(result)
            }
            Err(err) => Err(err),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_hello_world() {
        let code = r#"
            entry hello_world() {
                println("Hello, world!");
                return 0;
            }
        "#;

        let silex = Silex::new();
        let program = silex.compile_internal(code).expect("Failed to compile the program");
        let entries = program.entries();
        let entry = entries.get(0).expect("No entry found");
        let result = silex.execute_program_internal(program, entry.id() as u16, Some(50_000_000), IndexMap::new(), vec![], vec![]).await
            .expect("Failed to execute the program");

        assert_eq!(result.value(), "0");
    }
}