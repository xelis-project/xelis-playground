export class Silex {
    worker_silex: Worker;

    constructor() {
        this.worker_silex = new Worker(new URL("./workers/silex/silex_worker.js", import.meta.url));
    }

    _call<T>(func: string, params?: any) {
        return new Promise<T>((resolve, reject) => {
            const on_message = (event: MessageEvent<any>) => {
                if (event.data.func && event.data.func === func) {
                    resolve(event.data.result);
                    this.worker_silex.removeEventListener(`message`, on_message);
                }
            };

            this.worker_silex.addEventListener(`message`, on_message);

            this.worker_silex.postMessage({
                func,
                params
            });
        });
    }

    init() {
        return this._call("init");
    }

    compile(code: string) {
        return this._call<Program>("compile", { code });
    }

    execute_program(code: string, entry_id: number, max_gas: bigint | null | undefined, params: any[]) {
        return this._call<ExecutionResult>("execute_program", { code, entry_id, max_gas, params });
    }

    get_env_functions() {
        return this._call<Func[]>("get_env_functions");
    }

    has_program_running() {
        return this._call<boolean>("has_program_running");
    }

    get_constants_functions() {
        return this._call<ConstFunc[]>("get_constants_functions");
    }
}

export interface Func {
    syscall_id: number;
    name: string;
    params: string[];
    is_on_instance: boolean;
    return_type: string | null;
    on_type: string | null;
}

export interface ConstFunc {
    name: string;
    for_type: string;
    params: string[];
}

export interface Program {
    abi: string;
    hex: string;
    json: string;
    bytes: string;
    entries: ProgramEntry[];
}

export interface ProgramEntry {
    id: number;
    name: string;
    parameters: ProgramParameter[];
}

export interface ProgramParameter {
    type_json: { type: string, value: string };
    type_name: string;
    name: string;
}

export interface ExecutionResult {
    used_memory: string;
    used_gas: string;
    elapsed_time: string;
    used_gas_formatted: string;
    used_memory_formatted: string;
    logs: string[];
    value: string;
    storage: any[];
}
