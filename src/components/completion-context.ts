/** Lightweight inference for incomplete source; never runs the user's code. */
export type Callable = { name: string; owner?: string; instance: boolean; params: string[]; returns?: string };
type Token = string;
const tokenize = (source: string): Token[] => source.match(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*"|\b\d+(?:_[\d]+)*(?:u(?:8|16|32|64|128|256))?\b|[A-Za-z_]\w*|::|->|=>|[^\s]/g)?.filter(t => !t.startsWith('//') && !t.startsWith('/*')) ?? [];
const normalize = (type: string) => type.replace(/\s/g, '');

function bindings(pattern: string, actual: string): Map<string, string> | undefined {
    const p = tokenize(normalize(pattern)), a = tokenize(normalize(actual));
    const values = new Map<string, string>();
    let j = 0;
    for (let i = 0; i < p.length; i++) {
        if (/^T\d*$/.test(p[i])) {
            const start = j;
            let depth = 0;
            while (j < a.length) {
                if (!depth && p[i + 1] === a[j]) break;
                if (a[j] === '<' || a[j] === '[') depth++;
                if (a[j] === '>' || a[j] === ']') { if (!depth) break; depth--; }
                j++;
            }
            const value = a.slice(start, j).join('');
            if (!value || (values.has(p[i]) && values.get(p[i]) !== value)) return;
            values.set(p[i], value);
        } else if (p[i] !== a[j++]) return;
    }
    return j === a.length ? values : undefined;
}
export const matchesType = (pattern: string, actual: string): boolean => !!bindings(pattern, actual);

export function completionContext(source: string, environment: Callable[]) {
    const tokens = tokenize(source);
    const scopes: Map<string, string>[] = [new Map()];
    const locals: Callable[] = [];
    const lookup = (name: string) => {
        for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
    };
    const returnType = (name: string, owner?: string, instance = false): string | undefined => {
        const candidates = environment.concat(locals).filter(fn => fn.name === name && (owner ? fn.instance === instance && !!fn.owner && matchesType(fn.owner, owner) : !fn.owner));
        const types = candidates.map(fn => {
            if (!fn.returns) return undefined;
            const map = owner && fn.owner ? bindings(fn.owner, owner) : new Map<string, string>();
            return fn.returns.replace(/\bT\d*\b/g, key => map?.get(key) ?? key);
        });
        return types.length && types.every(type => type === types[0]) ? types[0] : undefined;
    };
    const infer = (expression: Token[], depth = 0): string | undefined => {
        if (!expression.length || depth > 20) return;
        let i = 0;
        const group = (open: string, close: string) => {
            const start = ++i;
            let nesting = 1;
            while (i < expression.length) {
                if (expression[i] === open) nesting++;
                if (expression[i] === close) { nesting--; if (nesting === 0) break; }
                i++;
            }
            const inner = expression.slice(start, i);
            i++;
            return inner;
        };
        let type: string | undefined;
        const first = expression[0];
        if (first.startsWith('"')) { type = 'string'; i++; }
        else if (/^\d/.test(first)) { type = first.match(/u(?:8|16|32|64|128|256)$/)?.[0] ?? 'u64'; i++; }
        else if (first === 'true' || first === 'false') { type = 'bool'; i++; }
        else if (first === '[') { const inner = group('[', ']'); const comma = inner.indexOf(','); const element = infer(comma < 0 ? inner : inner.slice(0, comma), depth + 1); type = element && element + '[]'; }
        else if (first === '(') type = infer(group('(', ')'), depth + 1);
        else {
            i++;
            if (expression[i] === '(') { group('(', ')'); type = returnType(first); }
            else type = lookup(first) ?? (expression[i] === '::' ? first : undefined);
        }
        while (i < expression.length && type) {
            const op = expression[i++];
            if (op === '[') { i--; group('[', ']'); type = type.endsWith('[]') ? type.slice(0, -2) : undefined; }
            else if (op === '.' || op === '::') {
                const name = expression[i++];
                if (expression[i] !== '(') return undefined;
                group('(', ')'); type = returnType(name, type, op === '.');
            } else if (op === 'as') { type = expression.slice(i).join(''); break; }
            else return undefined;
        }
        return type;
    };
    let statement = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '{') {
            const header = tokens.slice(statement, i).join(' ');
            const fn = header.match(/\b(?:fn|entry)\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+))?$/);
            scopes.push(new Map());
            if (fn) {
                const params = fn[2].split(/,(?![^<]*>)/).map(param => param.trim()).filter(Boolean);
                for (const param of params) { const [name, ...type] = param.split(':'); if (type.length) scopes.at(-1)!.set(name.trim(), normalize(type.join(':'))); }
                locals.push({ name: fn[1], params, instance: false, returns: fn[3] && normalize(fn[3]) });
            }
            statement = i + 1;
        } else if (tokens[i] === '}') { if (scopes.length > 1) scopes.pop(); statement = i + 1; }
        else if (tokens[i] === ';') {
            const part = tokens.slice(statement, i);
            const equal = part.indexOf('=');
            if (part[0] === 'let' && equal > 0) {
                const nameIndex = part[1] === 'mut' ? 2 : 1;
                const colon = part.indexOf(':');
                const type = colon >= 0 ? part.slice(colon + 1, equal).join('') : infer(part.slice(equal + 1));
                if (type) scopes.at(-1)!.set(part[nameIndex], type);
            }
            statement = i + 1;
        }
    }
    const variables = [...new Map(scopes.flatMap(scope => [...scope])).entries()].map(([name, type]) => ({ name, type }));
    const member = tokens.at(-1);
    if (member !== '.' && member !== '::') return { locals, variables, member: undefined, type: undefined };
    // Try expression suffixes, starting at the statement boundary (e.g. return value.method()).
    const expression = tokens.slice(statement, -1);
    let type: string | undefined;
    for (let start = 0; start < expression.length && !type; start++) {
        if (start && !['=', 'return', '(', ',', '+', '-', '*', '/'].includes(expression[start - 1])) continue;
        type = infer(expression.slice(start));
    }
    return { locals, variables, member, type };
}
