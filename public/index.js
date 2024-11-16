import init, { Silex } from "/xelis_playground.js";

console.log("Loading WASM module...");
await init();
console.log("WASM module loaded!");

const silex = new Silex();
const editor = document.getElementById('editor');
const logs = document.getElementById('logs');
const runButton = document.getElementById('runButton');

let code = localStorage.getItem('code');
if (!code) {
    code = `entry main() {
        println("Hello, World!");
        return 0;
}`;
}

editor.innerText = code;
// hljs.highlightElement(editor);

runButton.addEventListener('click', () => {
    const code = editor.innerText;

    // Placeholder logic for executing Rust code
    logs.innerText = "------- Compiling -------\n";
    try {
        let program = silex.compile(code);
        logs.innerText += "Compiled successfully!\n";

        localStorage.setItem('code', code);

        logs.innerText += "-------- Running --------\n";
        let result = silex.execute_program(program, 0);
        let output = result.logs();
        if (output.length > 0) {
            logs.innerText += `Output:\n`;
            logs.innerText += output.join("\n");
            logs.innerText += "\n";
        }

        logs.innerText += `Exit code: ${result.value()}\n`;
    } catch (e) {
        logs.innerText += "Error: " + e + "\n";
        return;
    }
});