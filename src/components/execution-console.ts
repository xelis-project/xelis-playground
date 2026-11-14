interface ExecutionResultView {
    logs(): string[];
    is_error(): boolean;
    value(): string;
    elapsed_time(): string;
    used_gas(): bigint;
    used_gas_formatted(): string;
    used_memory(): bigint;
    used_memory_formatted(): string;
    storage(): Array<{ key(): string; value(): string }>;
    events(): Array<{ contract(): string; event_id(): bigint; event(): string }>;
}

/** Console presentation stays independent from VM execution and editor state. */
export function renderExecutionResult(output: HTMLElement, result: ExecutionResultView) {
    const lines = [...result.logs(), '', '── Result ──'];
    lines.push(result.is_error() ? `Error raised: ${result.value()}` : `Exit value: ${result.value()}`);
    lines.push(`Executed in: ${result.elapsed_time()}`);
    lines.push(`Gas usage: ${result.used_gas()} lex (${result.used_gas_formatted()} XEL)`);
    lines.push(`Memory usage: ${result.used_memory()} (${result.used_memory_formatted()})`);
    const storage = result.storage();
    if (storage.length) lines.push('', '── Storage ──', ...storage.map(item => `${item.key()}: ${item.value()}`));
    const events = result.events();
    if (events.length) lines.push('', '── Events ──', ...events.map(event => `${event.contract()} #${event.event_id()}: ${event.event()}`));
    output.textContent = lines.join('\n');
}
