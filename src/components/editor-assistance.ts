import ace from 'ace-builds';
void ace;
import 'ace-builds/src-noconflict/ext-language_tools';
import type { Silex } from '../../public/xelis_playground';
import { completionContext, type Callable, matchesType } from './completion-context';

type Suggestion = { caption: string; value: string; meta: string; score: number; snippet?: string; docText?: string };

/** Completion and idle validation share the currently selected VM environment. */
export class EditorAssistance {
    private timer?: ReturnType<typeof setTimeout>;
    private readonly enabled = document.getElementById('auto-compile') as HTMLInputElement;
    private readonly delay = document.getElementById('auto-compile-delay') as HTMLSelectElement;
    private readonly status = document.getElementById('editor-check-status')!;

    constructor(private editor: ace.Editor, private silex: Silex, private version: () => number) {
        editor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: false });
        // Use VM metadata rather than the Rust mode's unrelated completions.
        editor.completers = [{
            getCompletions: (_editor, session, position, prefix, callback) => {
                try { callback(null, this.suggestions(session.getValue().slice(0, session.doc.positionToIndex(position) - prefix.length)).filter(item => item.value.toLowerCase().startsWith(prefix.toLowerCase()))); }
                catch { callback(null, []); }
            },
        }];
        this.enabled.checked = localStorage.getItem('auto-compile') !== 'false';
        const saved = localStorage.getItem('auto-compile-delay') ?? '2000';
        this.delay.value = ['1000', '2000', '3000', '5000'].includes(saved) ? saved : '2000';
        const update = () => {
            localStorage.setItem('auto-compile', String(this.enabled.checked));
            localStorage.setItem('auto-compile-delay', this.delay.value);
            this.delay.disabled = !this.enabled.checked;
            this.schedule();
        };
        this.enabled.addEventListener('change', update);
        this.delay.addEventListener('change', update);
        editor.session.on('change', () => this.schedule());
        document.getElementById('contract-version-menu')!.addEventListener('click', () => this.schedule());
        update();
    }

    private suggestions(source: string): Suggestion[] {
        this.silex.set_contract_version(this.version());
        const functions: Callable[] = [];
        for (const fn of this.silex.get_env_functions()) {
            try {
                functions.push({ name: fn.name(), owner: fn.on_type(), instance: fn.is_on_instance(), params: fn.params(), returns: fn.return_type() });
            } finally { fn.free(); }
        }
        for (const fn of this.silex.get_constants_functions()) {
            try {
                functions.push({ name: fn.name(), owner: fn.for_type(), instance: false, params: fn.params(), returns: fn.for_type() });
            } finally { fn.free(); }
        }
        const context = completionContext(source, functions);
        const suggestions: Suggestion[] = functions.concat(context.locals).filter(fn => {
            if (!context.member) return !fn.owner;
            return !!context.type && !!fn.owner && fn.instance === (context.member === '.') && matchesType(fn.owner, context.type);
        }).map(fn => ({
            caption: fn.name, value: fn.name,
            snippet: fn.name + (fn.params.length ? '(${1})$0' : '()$0'),
            docText: `${fn.name}(${fn.params.join(', ')})${fn.returns ? ' → ' + fn.returns : ''}`,
            meta: fn.returns || fn.owner || 'function', score: 1000,
        }));
        if (!context.member) {
            suggestions.push(...context.variables.map(variable => ({ caption: variable.name, value: variable.name, meta: variable.type, score: 1200 })));
        }
        return suggestions;
    }

    private schedule() {
        clearTimeout(this.timer);
        this.editor.session.clearAnnotations();
        this.status.textContent = this.enabled.checked ? 'Waiting to check…' : '';
        this.status.dataset.state = 'pending';
        if (!this.enabled.checked) return;
        this.timer = setTimeout(() => this.check(), Number(this.delay.value));
    }

    private check() {
        try {
            this.silex.set_contract_version(this.version());
            const program = this.silex.compile(this.editor.getValue());
            program.free();
            this.status.textContent = 'Compiled successfully!';
            this.status.dataset.state = 'success';
        } catch (error) {
            const message = String(error);
            this.status.textContent = message;
            this.status.dataset.state = 'error';
            const line = message.match(/line\s*[:=]?\s*(\d+)/i);
            if (line) this.editor.session.setAnnotations([{ row: Math.max(0, Number(line[1]) - 1), column: 0, text: message, type: 'error' }]);
        }
    }
}
