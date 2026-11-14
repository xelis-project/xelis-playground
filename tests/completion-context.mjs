import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/components/completion-context.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { completionContext, matchesType } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const env = [
 { name:'trim', owner:'string', instance:true, params:[], returns:'string' },
 { name:'len', owner:'string', instance:true, params:[], returns:'u32' },
 { name:'pop', owner:'T0[]', instance:true, params:[], returns:'optional<T0>' },
 { name:'unwrap', owner:'optional<T0>', instance:true, params:[], returns:'T0' },
 { name:'new', owner:'Hash', instance:false, params:[], returns:'Hash' },
 { name:'get_message', instance:false, params:[], returns:'string' },
];
for (const [source,type] of [
 ['entry main(message: string) { message.', 'string'],
 ['entry main() { let text = "hi"; text.', 'string'],
 ['entry main() { let text = get_message(); text.trim().', 'string'],
 ['entry main() { get_message().trim().len().', 'u32'],
 ['entry main(items: string[]) { items[0].', 'string'],
 ['entry main(items: string[]) { items.pop().unwrap().', 'string'],
 ['entry main() { let items = ["hi", "there"]; items[0].', 'string'],
 ['entry main() { Hash::new().', 'Hash'],
 ['entry main() { 1u8.', 'u8'],
 ['entry main(text: string) { { let text: u32 = 1; text.', 'u32'],
 ['entry main(text: string) { { let text: u32 = 1; } text.', 'string'],
 ['entry first(text: string) {} entry second() { text.', undefined],
 ['entry main() { unknown.', undefined],
 ['entry main() { unknown.get_message().', undefined],
 ['fn greeting() -> string { return "hi"; } entry main() { greeting().', 'string'],
]) assert.equal(completionContext(source,env).type,type,source);
assert.equal(matchesType('T0[]','string[]'),true);
assert.equal(matchesType('optional<T0>','optional<string[]>'),true);
assert.equal(matchesType('map<T0,T1>','map<string,u64>'),true);
assert.equal(matchesType('string','u64'),false);
console.log('Scoped receiver, call chains, arrays, generic returns and unknown-type checks passed.');

assert.deepEqual(completionContext('fn add(left: Ciphertext, right: Ciphertext) -> Ciphertext { println(',env).variables,[{name:'left',type:'Ciphertext'},{name:'right',type:'Ciphertext'}]);
