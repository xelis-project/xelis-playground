let silex, serializer;

onmessage = async (e) => {
    switch (e.data.func) {
        case "init":
            {
                const xelis = await import("../../../public/xelis_playground");
                serializer = await import("./serializer");

                console.log("Loading Silex WASM module...");
                await xelis.default();
                console.log("Silex WASM module loaded!");

                silex = new xelis.Silex();

                postMessage({
                    func: "init"
                });
            }
            break
        case "compile":
            {
                const { code } = e.data.params;
                const program = silex.compile(code);
                const result = serializer.serialize_program(program);
                postMessage({
                    func: "compile",
                    result
                });
            }
            break;
        case "execute_program":
            {
                const { code, entry_id, max_gas, params } = e.data.params;
                const program = silex.compile(code);
                const execution_result = await silex.execute_program(program, entry_id, max_gas, params);
                const result = serializer.serialize_execution_result(execution_result);
                postMessage({
                    func: "execute_program",
                    result
                });
            }
            break;
        case "get_env_functions":
            {
                const funcs = silex.get_env_functions();
                const result = funcs.map((func) => {
                    return serializer.serialize_func(func);
                });
                postMessage({
                    func: "get_env_functions",
                    result
                });
            }
            break;
        case "get_constants_functions":
            {
                const const_funcs = silex.get_constants_functions();
                const result = const_funcs.map((const_func) => {
                    return serializer.serialize_const_func(const_func);
                });
                postMessage({
                    func: "get_constants_functions",
                    result
                });
            }
            break
        case "has_program_running":
            {
                const is_running = silex.has_program_running();
                postMessage({
                    func: "has_program_running",
                    result: is_running
                });
            }
            break;
    }
}

