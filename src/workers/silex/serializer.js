import { Func, ConstFunc, Program, ExecutionResult } from "../../../public/xelis_playground";

/**
 * @param {Func} func
 * @returns {Object}
 */
export function serialize_func(func) {
    if (!(func instanceof Func)) {
        throw new Error("Expected a Func instance");
    }

    const syscall_id = func.syscall_id();
    const name = func.name();
    const params = func.params();
    const is_on_instance = func.is_on_instance();
    const return_type = func.return_type();
    const on_type = func.on_type();

    return {
        syscall_id,
        name,
        params,
        is_on_instance,
        return_type: return_type,
        on_type,
    };
}

/**
 * @param {ConstFunc} const_func
 * @returns {Object}
 */
export function serialize_const_func(const_func) {
    if (!(const_func instanceof ConstFunc)) {
        throw new Error("Expected a ConstFunc instance");
    }

    const name = const_func.name();
    const params = const_func.params();
    const for_type = const_func.for_type();

    return {
        name,
        params,
        for_type,
    };
}

/**
 * @param {Program} program
 * @returns {Object}
 */
export function serialize_program(program) {
    if (!(program instanceof Program)) {
        throw new Error("Expected a Program instance");
    }

    const json = program.to_json();
    const hex = program.to_hex();
    const bytes = program.to_bytes();
    const abi = program.to_abi();

    const entries = program.entries().map((entry) => {
        return {
            id: entry.id(),
            name: entry.name(),
            parameters: entry.parameters().map((parameter) => {
                return {
                    name: parameter.name(),
                    type_json: parameter.type_json(),
                    type_name: parameter.type_name()
                };
            })
        };
    });

    return {
        abi,
        bytes,
        hex,
        json,
        entries
    };
}

/**
 * @param {ExecutionResult} execution_result
 * @returns {Object}
 */
export function serialize_execution_result(execution_result) {
    if (!(execution_result instanceof ExecutionResult)) {
        throw new Error("Expected a ExecutionResult instance");
    }

    const used_memory = execution_result.used_memory();
    const used_gas = execution_result.used_gas();
    const elapsed_time = execution_result.elapsed_time();
    const used_gas_formatted = execution_result.used_gas_formatted();
    const used_memory_formatted = execution_result.used_memory_formatted();
    const logs = execution_result.logs();
    const value = execution_result.value();

    const storage = execution_result.storage().map((storage_entry) => {
        return {
            key: storage_entry.key(),
            value: storage_entry.value()
        };
    });

    return {
        used_memory,
        used_gas,
        elapsed_time,
        used_gas_formatted,
        used_memory_formatted,
        logs,
        value,
        storage
    };
}
