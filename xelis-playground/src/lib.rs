use std::sync::mpsc;

use humantime::format_duration;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use xelis_builder::EnvironmentBuilder;
use xelis_bytecode::{Module, OpCode};
use xelis_compiler::Compiler;
use xelis_lexer::Lexer;
use xelis_parser::Parser;
use xelis_vm::VM;
use xelis_types::Type;

#[wasm_bindgen]
pub struct Silex {
    environment: EnvironmentBuilder<'static>,
    logs_receiver: mpsc::Receiver<String>,
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
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Parameter {
    name: String,
    _type: String,
}

#[wasm_bindgen]
impl Parameter {
    pub fn name(&self) -> String {
        self.name.clone()
    }

    pub fn _type(&self) -> String {
        self._type.clone()
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Entry {
    id: u16,
    name: String,
    parameters: Vec<Parameter>,
}

#[wasm_bindgen]
impl Entry {
    pub fn id(&self) -> u16 {
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
pub struct ExecutionResult {
    value: String,
    logs: Vec<String>,
    elapsed_time: String,
    used_gas: u64,
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
}

static mut LOGS_SENDER: Option<mpsc::Sender<String>> = None;

#[wasm_bindgen]
impl Silex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut environment = EnvironmentBuilder::default();
        // Patch the environment to include a println function that sends logs to the receiver
        let (sender, receiver) = mpsc::channel();

        unsafe {
            LOGS_SENDER = Some(sender);
        }

        environment.get_mut_function("println", None, vec![Type::Any])
            .set_on_call(move |_, args, _| -> _ {
                let param = &args[0];
                let sender = unsafe { LOGS_SENDER.as_ref().unwrap() };
                sender.send(format!("{}", param.as_ref().as_value())).unwrap();
                Ok(None)
            });

        Self {
            environment,
            logs_receiver: receiver,
        }
    }

    fn compile_internal(&self, code: &str) -> anyhow::Result<Program> {
        let tokens = Lexer::new(code)
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;

        let parser = Parser::with(tokens.into_iter(), &self.environment);
        let (program, mapper) = parser.parse()
            .map_err(|err| anyhow::anyhow!("{:#}", err))?;

        // Collect all the available entry functions
        let mut entries = Vec::new();
        let env_offset = self.environment.get_functions().len() as u16;
        for (i, func) in program.functions().iter().enumerate() {
            if func.is_entry() {
                let mapping = mapper.get_function(&(i as u16 + env_offset)).unwrap();
                let parameters = mapping.parameters.iter()
                    .map(|(name, _type)| Parameter { name: name.to_string(), _type: _type.to_string() })
                    .collect();
    
                entries.push(Entry {
                    id: i as u16,
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

    // Execute the program
    pub fn execute_program(&self, program: Program, chunk_id: u16, max_gas: Option<u64>) -> Result<ExecutionResult, JsValue> {
        let mut vm = VM::new(&program.module, self.environment.environment());

        vm.table_mut()
            .set_instruction_cost(OpCode::IteratorNext, 50);

        vm.invoke_entry_chunk(chunk_id)
            .map_err(|err| JsValue::from_str(&format!("{:#}", err)))?;

        let context = vm.context_mut();
        context.set_gas_limit(max_gas);
        context.set_memory_price_per_byte(1);

        let start = web_time::Instant::now();
        let res = vm.run();
        let elapsed_time = start.elapsed();
        let used_gas = vm.context().current_gas_usage();

        let logs = self.logs_receiver.try_iter().collect();
        match res {
            Ok(value) => Ok(ExecutionResult {
                value: format!("{}", value),
                logs,
                elapsed_time: format_duration(elapsed_time).to_string(),
                used_gas,
            }),
            Err(err) => Err(JsValue::from_str(&format!("{:#}", err))),
        }
    }
}