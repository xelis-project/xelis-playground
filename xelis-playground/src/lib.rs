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
    asset::{AssetData, AssetOwner, MaxSupplyMode},
    block::{Block, BlockHeader, BlockVersion},
    config::{COIN_VALUE, MAXIMUM_SUPPLY, XELIS_ASSET},
    context::NoOpBuildHasher,
    contract::{
        ChainState,
        ContractMetadata,
        ContractVersion,
        ExecutionsChanges,
        ExecutionsManager,
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
use xelis_vm::{FnInstance, FnParams, FnReturnType, FunctionHandler, Primitive, SysCallResult, VM, VMContext, ValueCell};
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
    environments: HashMap<ContractVersion, EnvironmentBuilder<'static, ContractMetadata>>,
    logs_receiver: mpsc::Receiver<String>,
    is_running: AtomicBool,
    selected_version: ContractVersion,
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

    // Check if the program has a constructor (hook id 0)
    pub fn has_constructor(&self) -> bool {
        self.module.get_chunk_id_of_hook(0).is_some()
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
    value: Result<ValueCell, String>,
    logs: Vec<String>,
    elapsed_time: String,
    used_gas: u64,
    used_memory: u64,
    storage: MockStorage,
    // events per contract
    events: HashMap<Hash, HashMap<u64, Vec<ValueCell>, NoOpBuildHasher>>
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
            .map(|(contract, data)| data.iter().map(move |(k, v)| StorageEntry {
                contract: contract.to_hex(),
                key: format!("{}", k),
                value: format!("{}", v),
            }))
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
    fn create_environment(version: ContractVersion) -> EnvironmentBuilder<'static, ContractMetadata> {
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
        // Patch the environment to include a println function that sends logs to the receiver
        let (sender, receiver) = mpsc::channel();

        *LOGS_SENDER.lock().unwrap() = Some(sender);

        log!("Setting up environment...");

        Self {
            environments: ContractVersion::variants()
                .into_iter()
                .map(|version| (version, Self::create_environment(version)))
                .collect(),
            logs_receiver: receiver,
            is_running: AtomicBool::new(false),
            selected_version: ContractVersion::V1,
        }
    }

    fn println_fn(_: FnInstance, params: FnParams, _: &ModuleMetadata, _: &mut VMContext) -> FnReturnType<ContractMetadata> {
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

    fn debug_fn(_: FnInstance, params: FnParams, _: &ModuleMetadata, _: &mut VMContext) -> FnReturnType<ContractMetadata> {
        let param = &params[0];
        cfg_if! {
            if #[cfg(target_arch = "wasm32")] {
                let lock = LOGS_SENDER.lock().unwrap();
                let sender = lock.as_ref().unwrap();
                sender
                    .send(format!("{:?}", param.as_ref()))
                    .unwrap();
            } else {
                println!("DEBUG: {}", param.as_ref());
            }
        }

        Ok(SysCallResult::None)
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
        let abi = xelis_abi::abi_from_parse(&program, &mapper, &environment)
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
            types.push(format!("struct {} {{ {} }}", t.name(), t.fields()
                .iter()
                .map(|(n, ty)| format!("{}: {}", n, ty))
                .collect::<Vec<_>>()
                .join(", "))
            );
        }

        for ty in environment.get_enum_manager().iter() {
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
                let params: Vec<String> = const_fn.parameters.iter().map(|(name, ty)| 
                    format!("{}: {}", name, ty)
                ).collect();

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

    fn parse_str_to_number<T: std::str::FromStr>(value: &str) -> Result<T, JsValue> {
        value
            .trim()
            .parse::<T>()
            .map_err(|_| JsValue::from_str("Failed to parse the value as a number"))
    }

    fn js_value_to_string(value: JsValue) -> Result<String, JsValue> {
        if let Some(value) = value.as_string() {
            return Ok(value);
        }

        if let Some(value) = value.as_bool() {
            return Ok(value.to_string());
        }

        if let Some(value) = value.as_f64() {
            return Ok(value.to_string());
        }

        Err(JsValue::from_str("Expected a string-compatible value"))
    }

    fn parse_string_literal(value: &str) -> String {
        let trimmed = value.trim();
        let Some(quote) = trimmed.chars().next() else {
            return String::new();
        };

        if !matches!(quote, '"' | '\'') || !trimmed.ends_with(quote) || trimmed.len() < 2 {
            return value.to_owned();
        }

        let inner = &trimmed[quote.len_utf8()..trimmed.len() - quote.len_utf8()];
        let mut output = String::with_capacity(inner.len());
        let mut chars = inner.chars();

        while let Some(ch) = chars.next() {
            if ch != '\\' {
                output.push(ch);
                continue;
            }

            match chars.next() {
                Some('n') => output.push('\n'),
                Some('r') => output.push('\r'),
                Some('t') => output.push('\t'),
                Some('\\') => output.push('\\'),
                Some('"') => output.push('"'),
                Some('\'') => output.push('\''),
                Some(other) => output.push(other),
                None => output.push('\\'),
            }
        }

        output
    }

    fn strip_wrapping<'a>(
        value: &'a str,
        open: char,
        close: char,
        expected: &str,
    ) -> Result<&'a str, JsValue> {
        let value = value.trim();
        if !value.starts_with(open) || !value.ends_with(close) {
            return Err(JsValue::from_str(&format!(
                "Expected {} value wrapped in {}{}",
                expected, open, close
            )));
        }

        Ok(&value[open.len_utf8()..value.len() - close.len_utf8()])
    }

    fn find_top_level_delimiter(value: &str, delimiter: char) -> Result<Option<usize>, JsValue> {
        let mut stack = Vec::new();
        let mut quote = None;
        let mut escaped = false;

        for (index, ch) in value.char_indices() {
            if let Some(active_quote) = quote {
                if escaped {
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == active_quote {
                    quote = None;
                }
                continue;
            }

            match ch {
                '"' | '\'' => quote = Some(ch),
                '[' => stack.push(']'),
                '{' => stack.push('}'),
                '(' => stack.push(')'),
                ']' | '}' | ')' => {
                    if stack.pop() != Some(ch) {
                        return Err(JsValue::from_str(
                            "Mismatched delimiters in parameter value",
                        ));
                    }
                }
                _ if ch == delimiter && stack.is_empty() => return Ok(Some(index)),
                _ => {}
            }
        }

        if quote.is_some() || !stack.is_empty() {
            return Err(JsValue::from_str("Unclosed delimiter in parameter value"));
        }

        Ok(None)
    }

    fn split_top_level(value: &str, delimiter: char) -> Result<Vec<&str>, JsValue> {
        let value = value.trim();
        if value.is_empty() {
            return Ok(Vec::new());
        }

        let mut parts = Vec::new();
        let mut start = 0;
        let mut stack = Vec::new();
        let mut quote = None;
        let mut escaped = false;

        for (index, ch) in value.char_indices() {
            if let Some(active_quote) = quote {
                if escaped {
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == active_quote {
                    quote = None;
                }
                continue;
            }

            match ch {
                '"' | '\'' => quote = Some(ch),
                '[' => stack.push(']'),
                '{' => stack.push('}'),
                '(' => stack.push(')'),
                ']' | '}' | ')' => {
                    if stack.pop() != Some(ch) {
                        return Err(JsValue::from_str(
                            "Mismatched delimiters in parameter value",
                        ));
                    }
                }
                _ if ch == delimiter && stack.is_empty() => {
                    let part = value[start..index].trim();
                    if part.is_empty() {
                        return Err(JsValue::from_str("Empty item in parameter value"));
                    }

                    parts.push(part);
                    start = index + ch.len_utf8();
                }
                _ => {}
            }
        }

        if quote.is_some() || !stack.is_empty() {
            return Err(JsValue::from_str("Unclosed delimiter in parameter value"));
        }

        let part = value[start..].trim();
        if part.is_empty() {
            return Err(JsValue::from_str("Empty trailing item in parameter value"));
        }

        parts.push(part);
        Ok(parts)
    }

    fn parse_text_to_primitive(value: &str, param: &Type) -> Result<Primitive, JsValue> {
        Ok(match param {
            Type::U8 => Primitive::U8(Self::parse_str_to_number(value)?),
            Type::U16 => Primitive::U16(Self::parse_str_to_number(value)?),
            Type::U32 => Primitive::U32(Self::parse_str_to_number(value)?),
            Type::U64 => Primitive::U64(Self::parse_str_to_number(value)?),
            Type::U128 => Primitive::U128(Self::parse_str_to_number(value)?),
            Type::U256 => Primitive::U256(Self::parse_str_to_number(value)?),
            Type::String => Primitive::String(Self::parse_string_literal(value)),
            Type::Bool => Primitive::Boolean(
                value
                    .trim()
                    .parse::<bool>()
                    .map_err(|_| JsValue::from_str("Failed to parse as bool value"))?,
            ),
            Type::Range(inner) => {
                let parts: Vec<&str> = value.split("..").collect();
                if parts.len() != 2 {
                    return Err(JsValue::from_str("Invalid range format"));
                }

                let start = Self::parse_text_to_primitive(parts[0], inner)?;
                let end = Self::parse_text_to_primitive(parts[1], inner)?;

                Primitive::Range(Box::new((start, end)))
            }
            Type::Function(_) => Primitive::U16(Self::parse_str_to_number(value)?),
            _ => {
                return Err(JsValue::from_str(&format!(
                    "Unsupported parameter type parsing: {}",
                    param
                )));
            }
        })
    }

    fn parse_record_fields(
        &self,
        value: &str,
        fields: &[(Cow<'static, str>, Type)],
        owner: &str,
    ) -> Result<Vec<ValueCell>, JsValue> {
        let parts = Self::split_top_level(value, ',')?;
        if parts.len() != fields.len() {
            return Err(JsValue::from_str(&format!(
                "Invalid field count for {}: expected {}, got {}",
                owner,
                fields.len(),
                parts.len()
            )));
        }

        parts
            .into_iter()
            .zip(fields.iter())
            .map(|(part, (field_name, field_type))| {
                let value = if let Some(index) = Self::find_top_level_delimiter(part, ':')? {
                    let name = part[..index].trim();
                    if name != field_name.as_ref() {
                        return Err(JsValue::from_str(&format!(
                            "Invalid field name for {}: expected `{}`, got `{}`",
                            owner, field_name, name
                        )));
                    }

                    &part[index + ':'.len_utf8()..]
                } else {
                    part
                };

                self.parse_text_to_const(value.trim(), field_type)
            })
            .collect()
    }

    fn parse_array_text(&self, value: &str, inner: &Type) -> Result<ValueCell, JsValue> {
        let value = Self::strip_wrapping(value, '[', ']', "array")?;
        let values = Self::split_top_level(value, ',')?
            .into_iter()
            .map(|part| self.parse_text_to_const(part, inner).map(Into::into))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(ValueCell::Object(values))
    }

    fn parse_tuple_text(&self, value: &str, types: &[Type]) -> Result<ValueCell, JsValue> {
        let value = value.trim();
        let value = if value.starts_with('(') {
            Self::strip_wrapping(value, '(', ')', "tuple")?
        } else {
            Self::strip_wrapping(value, '[', ']', "tuple")?
        };

        let parts = Self::split_top_level(value, ',')?;
        if parts.len() != types.len() {
            return Err(JsValue::from_str(&format!(
                "Invalid tuple item count: expected {}, got {}",
                types.len(),
                parts.len()
            )));
        }

        let values = parts
            .into_iter()
            .zip(types.iter())
            .map(|(part, ty)| self.parse_text_to_const(part, ty).map(Into::into))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(ValueCell::Object(values))
    }

    fn parse_map_text(
        &self,
        value: &str,
        key_type: &Type,
        value_type: &Type,
    ) -> Result<ValueCell, JsValue> {
        let value = Self::strip_wrapping(value, '{', '}', "map")?;
        let mut map = IndexMap::new();

        for part in Self::split_top_level(value, ',')? {
            let index = Self::find_top_level_delimiter(part, ':')?
                .ok_or_else(|| JsValue::from_str("Expected `key: value` map entry"))?;
            let key = self.parse_text_to_const(part[..index].trim(), key_type)?;
            let value =
                self.parse_text_to_const(part[index + ':'.len_utf8()..].trim(), value_type)?;

            map.insert(key, value.into());
        }

        Ok(ValueCell::Map(Box::new(map)))
    }

    fn parse_struct_text(
        &self,
        value: &str,
        ty: &xelis_types::StructType,
    ) -> Result<ValueCell, JsValue> {
        let value = Self::strip_wrapping(value, '{', '}', ty.name())?;
        let values = self
            .parse_record_fields(value, ty.fields(), ty.name())?
            .into_iter()
            .map(Into::into)
            .collect();

        Ok(ValueCell::Object(values))
    }

    fn parse_enum_text(
        &self,
        value: &str,
        ty: &xelis_types::EnumType,
    ) -> Result<ValueCell, JsValue> {
        let value = value.trim();
        let value = value
            .rsplit_once("::")
            .map(|(_, variant)| variant)
            .unwrap_or(value);

        let payload_start = value
            .char_indices()
            .find(|(_, ch)| matches!(ch, '{' | '('))
            .map(|(index, ch)| (index, ch));

        let (variant_name, payload) = match payload_start {
            Some((index, open)) => {
                let close = if open == '{' { '}' } else { ')' };
                let payload = Self::strip_wrapping(&value[index..], open, close, "enum variant")?;
                (value[..index].trim(), Some(payload))
            }
            None => (value.trim(), None),
        };

        let (variant_id, (_, variant)) = ty
            .variants()
            .iter()
            .enumerate()
            .find(|(_, (name, _))| name.as_ref() == variant_name)
            .ok_or_else(|| {
                JsValue::from_str(&format!(
                    "Unknown enum variant `{}` for {}",
                    variant_name,
                    ty.name()
                ))
            })?;

        let variant_id = u8::try_from(variant_id)
            .map_err(|_| JsValue::from_str("Enum variant id exceeds u8"))?;

        let mut values = vec![Primitive::U8(variant_id).into()];
        if variant.fields().is_empty() {
            if payload
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
            {
                return Err(JsValue::from_str(&format!(
                    "Enum variant `{}` does not accept fields",
                    variant_name
                )));
            }

            return Ok(ValueCell::Object(values));
        }

        let payload = payload.ok_or_else(|| {
            JsValue::from_str(&format!("Enum variant `{}` requires fields", variant_name))
        })?;

        values.extend(
            self.parse_record_fields(payload, variant.fields(), variant_name)?
                .into_iter()
                .map(Into::into),
        );

        Ok(ValueCell::Object(values))
    }

    fn parse_untyped_text(&self, value: &str) -> Result<ValueCell, JsValue> {
        let trimmed = value.trim();
        if trimmed.eq_ignore_ascii_case("null") || trimmed.is_empty() {
            return Ok(Primitive::Null.into());
        }

        if trimmed.eq_ignore_ascii_case("true") || trimmed.eq_ignore_ascii_case("false") {
            return Ok(Primitive::Boolean(trimmed.parse::<bool>().unwrap()).into());
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            return self.parse_array_text(trimmed, &Type::Any);
        }

        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            return self.parse_map_text(trimmed, &Type::Any, &Type::Any);
        }

        if trimmed.starts_with('"') || trimmed.starts_with('\'') {
            return Ok(Primitive::String(Self::parse_string_literal(trimmed)).into());
        }

        if let Ok(value) = trimmed.parse::<u64>() {
            return Ok(Primitive::U64(value).into());
        }

        Ok(Primitive::String(value.to_owned()).into())
    }

    fn parse_text_to_const(&self, value: &str, param: &Type) -> Result<ValueCell, JsValue> {
        Ok(match param {
            Type::Optional(ty) => {
                let trimmed = value.trim();
                if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
                    Primitive::Null.into()
                } else {
                    self.parse_text_to_const(value, ty)?
                }
            }
            Type::Voidable(ty) => self.parse_text_to_const(value, ty)?,
            Type::Bytes => {
                let value = Self::parse_string_literal(value);
                let value = value.strip_prefix("0x").unwrap_or(&value);
                let bytes = hex::decode(value)
                    .map_err(|_| JsValue::from_str("Failed to parse as blob (hex) value"))?;
                ValueCell::Bytes(bytes)
            }
            Type::Opaque(ty) => {
                let environment = &self.environments[&self.selected_version];
                let name = environment
                    .get_opaque_name(ty)
                    .ok_or_else(|| JsValue::from_str("Failed to get opaque name"))?;

                match name {
                    "Hash" => {
                        let value = Self::parse_string_literal(value);
                        let hash = Hash::from_hex(&value)
                            .map_err(|_| JsValue::from_str("Failed to parse as hash value"))?;
                        Primitive::Opaque(hash.into()).into()
                    }
                    "Address" => {
                        let value = Self::parse_string_literal(value);
                        let address = Address::from_string(&value).map_err(|e| {
                            JsValue::from_str(&format!("Failed to parse as address value: {}", e))
                        })?;

                        Primitive::Opaque(address.into()).into()
                    }
                    "Signature" => {
                        let value = Self::parse_string_literal(value);
                        let signature = Signature::from_hex(&value)
                            .map_err(|_| JsValue::from_str("Failed to parse as signature value"))?;
                        Primitive::Opaque(signature.into()).into()
                    }
                    _ => {
                        return Err(JsValue::from_str(&format!(
                            "Unsupported opaque type parsing: {}",
                            name
                        )))
                    }
                }
            }
            Type::Array(inner) => self.parse_array_text(value, inner)?,
            Type::Map(key, value_type) => self.parse_map_text(value, key, value_type)?,
            Type::Struct(ty) => self.parse_struct_text(value, ty)?,
            Type::Enum(ty) => self.parse_enum_text(value, ty)?,
            Type::Tuples(types) => self.parse_tuple_text(value, types)?,
            Type::Closure(_) => {
                self.parse_tuple_text(value, &[Type::U16, Type::Bool, Type::U16])?
            }
            Type::Any | Type::T(_) => self.parse_untyped_text(value)?,
            _ => ValueCell::Primitive(Self::parse_text_to_primitive(value, param)?),
        })
    }

    fn parse_js_value_to_const(&self, value: JsValue, param: &Type) -> Result<ValueCell, JsValue> {
        if value.is_null() || value.is_undefined() {
            return match param {
                Type::Optional(_) => Ok(Primitive::Null.into()),
                _ => Err(JsValue::from_str("Expected a parameter value")),
            };
        }

        let value = Self::js_value_to_string(value)?;
        self.parse_text_to_const(&value, param)
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
        run_constructor: bool,
    ) -> Result<ExecutionResult, String> {
        log!("Executing program with entry_id: {}, max_gas: {:?}, values: {:?}", entry_id, max_gas, values);

        let environments = self.environments
            .iter()
            .map(|(version, env)| (*version, Arc::new(env.environment().clone())))
            .collect::<HashMap<_, _>>();

        let selected_version = self.selected_version;
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
                storage.balances.entry(hash.clone())
                    .or_default()
                    .insert(Hash::zero(), match amount {
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
                BlockVersion::V6,
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
                debug_mode: true,
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
                cache_clone_refs: selected_version == ContractVersion::V0,
            };

            let environment = &environments[&selected_version];
            let mut logs = Vec::new();
            let (res, elapsed_time, used_gas, used_memory) = {
                let mut vm = VM::default();
                vm.append_module(ModuleMetadata {
                    module: (&program.module).into(),
                    environment: environment.clone().into(),
                    metadata: (&metadata).into(),
                }).map_err(|e| format!("Error while adding module: {}", e))?;

                let context = vm.context_mut();
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

                    if res != ValueCell::Primitive(Primitive::U64(0)) {
                        return Err(format!("Constructor returned a non-zero exit code: {:#}", res));
                    }

                    // VM has consumed the module, lets re-inject it again
                    vm.append_module(ModuleMetadata {
                        module: (&program.module).into(),
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
                let context = vm.context();
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
                let amount = amount_str.parse::<u64>()
                    .map_err(|e| JsValue::from_str(&format!("Invalid amount: {}", e)))?;
                
                deposits.insert(hash, ContractDeposit::Public(amount));
            }
        }

        // Mark it as running
        self.is_running.store(true, Ordering::Relaxed);

        let chunk_id = entry.chunk_id;
        let handle = self.execute_program_internal(program, chunk_id, max_gas, deposits, values, sp_list, run_constructor).await
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
    use std::borrow::Cow;

    use xelis_common::config::MAX_GAS_USAGE_PER_TX;
    use xelis_types::{EnumVariant, StructType};

    use super::*;

    #[tokio::test]
    async fn test_hello_world() {
        let code = r#"
            entry hello_world(a: string, b: string) {
                assert(a == "Hello");
                assert(b == "world");
                println(a + ", " + b + "!");
                return 0;
            }
        "#;

        let silex = Silex::new();
        let program = silex
            .compile_internal(code)
            .expect("Failed to compile the program");
        let entries = program.entries();
        let entry = entries.get(0).expect("No entry found");
        let result = silex
            .execute_program_internal(
                program,
                entry.id() as u16,
                Some(MAX_GAS_USAGE_PER_TX),
                IndexMap::new(),
                vec![
                    Primitive::String("Hello".to_string()).into(),
                    Primitive::String("world".to_string()).into(),
                ],
                vec![],
                true,
            )
            .await
            .expect("Failed to execute the program");

        assert_eq!(result.value(), "0");
    }

    #[test]
    fn test_parse_string_array_parameter() {
        let silex = Silex::new();
        let ty = Type::Array(Box::new(Type::String));

        let value = silex
            .parse_text_to_const("[hello, world]", &ty)
            .expect("Failed to parse string array");

        assert_eq!(
            value,
            ValueCell::Object(vec![
                Primitive::String("hello".to_owned()).into(),
                Primitive::String("world".to_owned()).into(),
            ])
        );
    }

    #[test]
    fn test_parse_nested_parameter_combinations() {
        let silex = Silex::new();
        let ty = Type::Map(
            Box::new(Type::String),
            Box::new(Type::Array(Box::new(Type::U64))),
        );

        let value = silex
            .parse_text_to_const("{first: [1, 2], second: [3]}", &ty)
            .expect("Failed to parse nested map/array");

        let ValueCell::Map(map) = value else {
            panic!("Expected map value");
        };

        let first_key: ValueCell = Primitive::String("first".to_owned()).into();
        let first = map.get(&first_key).expect("Missing first key");
        assert_eq!(
            first.as_ref(),
            &ValueCell::Object(vec![Primitive::U64(1).into(), Primitive::U64(2).into(),])
        );

        let second_key: ValueCell = Primitive::String("second".to_owned()).into();
        let second = map.get(&second_key).expect("Missing second key");
        assert_eq!(
            second.as_ref(),
            &ValueCell::Object(vec![Primitive::U64(3).into(),])
        );
    }

    #[test]
    fn test_parse_struct_and_enum_parameters() {
        let silex = Silex::new();
        let struct_type = StructType::new(
            1,
            "Payload",
            vec![
                (Cow::Borrowed("names"), Type::Array(Box::new(Type::String))),
                (Cow::Borrowed("enabled"), Type::Bool),
            ],
        );

        let value = silex
            .parse_text_to_const(
                "{names: [alice, bob], enabled: true}",
                &Type::Struct(struct_type),
            )
            .expect("Failed to parse struct");

        assert_eq!(
            value,
            ValueCell::Object(vec![
                ValueCell::Object(vec![
                    Primitive::String("alice".to_owned()).into(),
                    Primitive::String("bob".to_owned()).into(),
                ])
                .into(),
                Primitive::Boolean(true).into(),
            ])
        );

        let enum_type = xelis_types::EnumType::new(
            2,
            "Choice",
            vec![
                (Cow::Borrowed("None"), EnumVariant::new(Vec::new())),
                (
                    Cow::Borrowed("Names"),
                    EnumVariant::new(vec![(
                        Cow::Borrowed("values"),
                        Type::Array(Box::new(Type::String)),
                    )]),
                ),
            ],
        );

        let value = silex
            .parse_text_to_const(
                "Choice::Names{values: [alice, bob]}",
                &Type::Enum(enum_type),
            )
            .expect("Failed to parse enum");

        assert_eq!(
            value,
            ValueCell::Object(vec![
                Primitive::U8(1).into(),
                ValueCell::Object(vec![
                    Primitive::String("alice".to_owned()).into(),
                    Primitive::String("bob".to_owned()).into(),
                ])
                .into(),
            ])
        );
    }

    #[tokio::test]
    async fn test_execute_program_with_string_array_parameter() {
        let code = r#"
            entry assert_strings(values: string[]) {
                assert(values.len() == 2);
                assert(values[0] == "hello");
                assert(values[1] == "world");
                return 0;
            }
        "#;

        let silex = Silex::new();
        let program = silex
            .compile_internal(code)
            .expect("Failed to compile the program");
        let entry = program.entries().get(0).expect("No entry found").clone();
        let value = silex
            .parse_text_to_const("[hello, world]", &entry.parameters[0].ty)
            .expect("Failed to parse entry parameter");
        let result = silex
            .execute_program_internal(
                program,
                entry.id() as u16,
                Some(MAX_GAS_USAGE_PER_TX),
                IndexMap::new(),
                vec![value],
                vec![],
                true,
            )
            .await
            .expect("Failed to execute the program");

        assert_eq!(result.value(), "0");
    }
}
