use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use xelis_builder::EnvironmentBuilder;
use xelis_bytecode::Module;
use xelis_compiler::Compiler;
use xelis_lexer::Lexer;
use xelis_parser::Parser;
use xelis_vm::VM;

#[wasm_bindgen]
pub struct Silex {
    environment: EnvironmentBuilder<'static>,
}

#[wasm_bindgen]
pub struct Program {
    module: Module,
}

#[wasm_bindgen]
impl Silex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            environment: EnvironmentBuilder::new(),
        }
    }

    fn compile_internal(&self, code: &str) -> anyhow::Result<Program> {
        let tokens = Lexer::new(code).get()?;

        let parser = Parser::new(tokens, &self.environment);
        let (program, _) = parser.parse().map_err(|err| anyhow::anyhow!("{:?}", err))?;
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

    pub fn execute_program(&self, program: Program, chunk_id: u16) -> Result<String, JsValue> {
        let mut vm = VM::new(&program.module, self.environment.environment());
        vm.invoke_entry_chunk(chunk_id)
            .map_err(|err| JsValue::from_str(&format!("{:#}", err)))?;

        match vm.run() {
            Ok(value) => Ok(format!("{}", value)),
            Err(err) => Err(JsValue::from_str(&format!("{:#}", err))),
        }
    }
}