mod storage;

use std::{
    borrow::Cow,
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

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

use serde::Deserialize;
use silex_assembler::Disassembler;
use silex_builder::{Builder, EnvironmentBuilder};
use silex_compiler::Compiler;
use silex_lexer::Lexer;
use silex_parser::Parser;
use silex_types::Type;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use xelis_common::{
    account::CiphertextCache,
    asset::{AssetData, AssetOwner, MaxSupplyMode},
    block::{Block, BlockHeader, BlockVersion},
    config::{COIN_VALUE, MAXIMUM_SUPPLY, XELIS_ASSET},
    contract::{
        build_environment, vm::ContractCaller, ChainState, ContractMetadata, ContractModule,
        ContractVersion, ExecutionsChanges, ExecutionsManager, InterContractPermission,
        ModuleMetadata,
    },
    crypto::{elgamal::CompressedPublicKey, proofs::RangeProof, Address, Hash, Signature},
    immutable::Immutable,
    serializer::Serializer,
    transaction::{
        ContractDeposit, InvokeContractPayload, Reference, Transaction, TransactionType, TxVersion,
    },
    utils::format_xelis,
};
use xelis_vm::{
    tid, EnvironmentError, FunctionHandler, NativeScope, OwnedValue, Primitive, PrimitiveInteger,
    PrimitiveRange, VMContext, VM,
};

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

mod execution;
mod parameters;

#[wasm_bindgen]
pub struct Silex {
    environments: HashMap<ContractVersion, EnvironmentBuilder<'static, ContractMetadata>>,
    is_running: AtomicBool,
    selected_version: ContractVersion,
}

#[wasm_bindgen]
pub struct Program {
    contract: ContractModule,
    entries: Vec<Entry>,
    abi: String,
}

#[wasm_bindgen]
impl Program {
    // Get the entries of the program
    pub fn entries(&self) -> Vec<Entry> {
        self.entries.clone()
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>, JsValue> {
        self.contract
            .to_bytes()
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    pub fn to_hex(&self) -> Result<String, JsValue> {
        self.to_bytes().map(hex::encode)
    }

    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string_pretty(&self.contract)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    pub fn to_abi(&self) -> String {
        self.abi.clone()
    }

    pub fn to_asm(&self) -> Result<String, JsValue> {
        let mut disassembler = Disassembler::new(&self.contract.module);
        disassembler
            .disasemble()
            .map(|asm| asm.to_string())
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    // Check if the program has a constructor (hook id 0)
    pub fn has_constructor(&self) -> bool {
        self.contract.module.get_chunk_id_of_hook(0).is_some()
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Parameter {
    name: String,
    ty: Type,
}

#[wasm_bindgen]
impl Parameter {
    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn type_json(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.ty).expect("Expected valid serialization")
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
    contract: String,
    key: String,
    value: String,
}

#[wasm_bindgen]
pub struct EventEntry {
    contract: String,
    event_id: u64,
    event: String,
}

#[wasm_bindgen]
impl EventEntry {
    pub fn contract(&self) -> String {
        self.contract.clone()
    }

    pub fn event_id(&self) -> u64 {
        self.event_id
    }

    pub fn event(&self) -> String {
        self.event.clone()
    }
}

#[wasm_bindgen]
impl StorageEntry {
    pub fn contract(&self) -> String {
        self.contract.clone()
    }

    pub fn key(&self) -> String {
        self.key.clone()
    }

    pub fn value(&self) -> String {
        self.value.clone()
    }
}

#[wasm_bindgen]
pub struct ExecutionResult {
    value: Result<OwnedValue, String>,
    logs: Vec<String>,
    elapsed_time: String,
    used_gas: u64,
    used_memory: u64,
    storage: MockStorage,
    // events per contract
    events: HashMap<Hash, HashMap<u64, Vec<OwnedValue>>>,
}

#[wasm_bindgen]
impl ExecutionResult {
    pub fn value(&self) -> String {
        match &self.value {
            Ok(v) => format!("{}", v),
            Err(e) => e.clone(),
        }
    }

    pub fn is_error(&self) -> bool {
        self.value.is_err()
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
            .map(|(contract, data)| {
                data.iter().map(move |(k, v)| StorageEntry {
                    contract: contract.to_hex(),
                    key: format!("{}", k),
                    value: format!("{}", v),
                })
            })
            .flatten()
            .collect()
    }

    pub fn events(&self) -> Vec<EventEntry> {
        let mut event_entries = Vec::new();

        for (contract, events_map) in &self.events {
            for (event_id, events) in events_map {
                for event in events {
                    event_entries.push(EventEntry {
                        contract: contract.to_hex(),
                        event_id: *event_id,
                        event: format!("{}", event),
                    });
                }
            }
        }

        event_entries
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
    comment: Option<String>,
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

    pub fn comment(&self) -> Option<String> {
        self.comment.clone()
    }
}

#[wasm_bindgen]
pub struct ConstFunc {
    name: String,
    for_type: String,
    params: Vec<String>,
    comment: Option<String>,
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

    pub fn comment(&self) -> Option<String> {
        self.comment.clone()
    }
}

#[derive(Default)]
struct ExecutionLogs(Vec<String>);

tid!(ExecutionLogs);

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
    key: OwnedValue,
    value: OwnedValue,
}

#[wasm_bindgen]
impl Silex {
    fn create_environment(
        version: ContractVersion,
    ) -> EnvironmentBuilder<'static, ContractMetadata> {
        log!("Creating environment for version: {:?}", version);
        let mut environment = build_environment::<MockStorage>(version);

        environment
            .get_mut_function("println", None)
            .set_on_call(FunctionHandler::Sync(Self::println_fn));

        environment
            .get_mut_function("debug", None)
            .set_on_call(FunctionHandler::Sync(Self::debug_fn));

        environment
    }

    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        log!("Initializing Silex...");
        log!("Setting up environment...");

        Self {
            environments: ContractVersion::variants()
                .into_iter()
                .map(|version| (version, Self::create_environment(version)))
                .collect(),
            is_running: AtomicBool::new(false),
            selected_version: ContractVersion::V1,
        }
    }

    fn println_fn(
        scope: &mut NativeScope<'_, ContractMetadata>,
        _: &ModuleMetadata,
        context: &mut VMContext,
    ) -> Result<(), EnvironmentError> {
        let value = scope.snapshot(scope.argument(0)?)?;
        context
            .get_mut::<ExecutionLogs>()
            .ok_or(EnvironmentError::InvalidParameter)?
            .0
            .push(value.to_string());
        Ok(())
    }

    fn debug_fn(
        scope: &mut NativeScope<'_, ContractMetadata>,
        _: &ModuleMetadata,
        context: &mut VMContext,
    ) -> Result<(), EnvironmentError> {
        let value = scope.snapshot(scope.argument(0)?)?;
        context
            .get_mut::<ExecutionLogs>()
            .ok_or(EnvironmentError::InvalidParameter)?
            .0
            .push(format!("{value:?}"));
        Ok(())
    }

    fn compile_internal(&self, code: &str) -> anyhow::Result<Program> {
        log!("Compiling code:\n{}", code);
        let tokens = Lexer::new(code)
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;

        let environment = &self.environments[&self.selected_version];
        let parser = Parser::with(tokens.into_iter(), &environment);
        let (program, mapper) = match parser.parse() {
            Ok(res) => res,
            Err(err) => {
                log!("Parser error: {:#}", err);
                return Err(anyhow::anyhow!("{:#}", err));
            }
        };

        // Collect all the available entry functions
        let mut entries = Vec::new();
        let env_offset = environment.get_functions().len() as u16;
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
        let mut compiler = Compiler::new(&program, environment.environment());
        if self.selected_version >= ContractVersion::V1 {
            compiler = compiler.with_enforce_public_parameters(true);
        }

        let module = compiler.compile()?;

        log!("Compiled module");
        let abi = silex_abi::abi_from_parse(&program, &mapper, &environment)?;

        Ok(Program {
            contract: ContractModule {
                module: Arc::new(module),
                version: self.selected_version,
            },
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

    // Set the contract version
    pub fn set_contract_version(&mut self, version: u8) -> Result<(), JsValue> {
        let contract_version = ContractVersion::from_bytes(&[version])
            .map_err(|_| JsValue::from_str("Invalid contract version"))?;

        self.selected_version = contract_version;
        Ok(())
    }

    pub fn get_contract_version(&self) -> u8 {
        self.selected_version as u8
    }

    pub fn available_contract_versions(&self) -> Vec<u8> {
        ContractVersion::variants()
            .into_iter()
            .map(|v| v as u8)
            .collect()
    }

    // Check if a program is running
    pub fn has_program_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    pub fn get_env_functions(&self) -> Vec<Func> {
        let mapper = self.environments[&self.selected_version].get_functions_mapper();
        let mut funcs = Vec::new();

        for (_t, list) in mapper.get_declared_functions() {
            for (f, syscall_id) in list {
                let params: Vec<String> = f
                    .parameters
                    .iter()
                    .map(|(name, ty)| format!("{}: {}", name, ty))
                    .collect();

                funcs.push(Func {
                    name: f.name.to_string(),
                    on_type: f.on_type.as_ref().map(Type::to_string),
                    on_instance: f.require_instance && f.on_type.is_some(),
                    return_type: f.return_type.as_ref().map(Type::to_string),
                    params,
                    syscall_id,
                    cost: f.cost,
                    comment: f.comment.map(str::to_owned),
                });
            }
        }

        funcs
    }

    pub fn get_declared_types(&self) -> Vec<String> {
        let environment = &self.environments[&self.selected_version];
        let mut types = Vec::new();
        for ty in environment.get_struct_manager().iter() {
            let t = ty.get_type();
            types.push(format!(
                "struct {} {{ {} }}",
                t.name(),
                t.fields()
                    .iter()
                    .map(|(n, ty)| format!("{}: {}", n, ty))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }

        for ty in environment.get_enum_manager().iter() {
            let t = ty.get_type();
            // enum Name { Variant1: { field1: Type1, field2: Type2 }, Variant2: { field1: Type1 } }
            types.push(format!(
                "enum {} {{\n    {}\n}}",
                t.name(),
                t.variants()
                    .iter()
                    .map(|(variant_name, ty)| {
                        let fields = ty
                            .fields()
                            .as_ref()
                            .iter()
                            .map(|(field_name, field_type)| {
                                format!("{}: {}", field_name, field_type)
                            })
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
                    .join(",\n")
            ));
        }

        for ty in environment.get_opaque_manager().iter() {
            types.push(format!("opaque {};", ty.name()));
        }

        types
    }

    pub fn get_constants_functions(&self) -> Vec<ConstFunc> {
        let environment = &self.environments[&self.selected_version];
        let mut funcs = Vec::new();
        for (for_type, mappings) in environment.get_const_functions_mapper().get_mappings() {
            for (name, const_fn) in mappings.iter() {
                let params: Vec<String> = const_fn
                    .parameters
                    .iter()
                    .map(|(name, ty)| format!("{}: {}", name, ty))
                    .collect();

                funcs.push(ConstFunc {
                    name: name.to_string(),
                    for_type: for_type.to_string(),
                    params,
                    comment: const_fn.comment.map(str::to_owned),
                });
            }
        }

        funcs
    }
}

#[cfg(test)]
mod tests;
