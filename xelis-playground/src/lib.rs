use std::sync::mpsc;

use humantime::format_duration;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use xelis_builder::EnvironmentBuilder;
use xelis_bytecode::Module;
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
        let (program, _) = parser.parse().map_err(|err| anyhow::anyhow!("{:#}", err))?;
        let compiler = Compiler::new(&program, self.environment.environment());

        Ok(Program {
            module: compiler.compile()?
        })
    }

    pub fn compile(&self, code: &str) -> Result<Program, JsValue> {
        match self.compile_internal(code) {
            Ok(program) => Ok(program),
            Err(err) => Err(JsValue::from_str(&format!("{:#}", err))),
        }
    }

    pub fn execute_program(&self, program: Program, chunk_id: u16) -> Result<ExecutionResult, JsValue> {
        let mut vm = VM::new(&program.module, self.environment.environment());
        vm.invoke_entry_chunk(chunk_id)
            .map_err(|err| JsValue::from_str(&format!("{:#}", err)))?;

        let context = vm.context_mut();
        context.set_gas_limit(Some(u64::MAX));
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