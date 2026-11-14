import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'inherit' });
const url = 'http://127.0.0.1:4175';
let browser;
try {
 for (let attempt=0; attempt<100; attempt++) {
  if (server.exitCode !== null) throw new Error('Preview server exited');
  try { if ((await fetch(url)).ok) break; } catch {}
  if (attempt === 99) throw new Error('Preview server did not start');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 const executablePath = process.env.BROWSER_EXECUTABLE || (existsSync('/opt/google/chrome/chrome') ? '/opt/google/chrome/chrome' : undefined);
 browser=await chromium.launch({executablePath,headless:true,args:process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);
await page.waitForSelector('#runtime-status[data-state="ready"]');
await page.waitForTimeout(500);
// Check token categories and actual rendered Dark+ colors.
const syntax = await page.evaluate(async () => {
 const editor = document.getElementById('input_editor').env.editor;
 editor.setValue('entry main(message: string) {\n let count: u64 = 42;\n println(message); // comment\n return true;\n}', -1);
 editor.renderer.updateFull();
 await new Promise(resolve => requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const tokens = Array.from({length:5},(_,row)=>editor.session.getTokens(row)).flat();
 const color = selector => getComputedStyle(document.querySelector('#input_editor '+selector)).color;
 return { tokens, colors: {
  function:color('.ace_entity.ace_name.ace_function'),
  variable:color('.ace_variable'), type:color('.ace_support.ace_type'),
  keyword:color('.ace_storage'), number:color('.ace_constant.ace_numeric'),
  comment:color('.ace_comment'), control:color('.ace_keyword.ace_control'),
 }};
});
for (const [value,type] of [['main','entity.name.function'],['message','variable'],['string','support.type'],['42','constant.numeric'],['return','keyword.control']]) {
 assert.ok(syntax.tokens.some(token=>token.value===value&&token.type===type), `${value}: ${type}`);
}
assert.equal(syntax.colors.function,'rgb(220, 220, 170)');
assert.equal(syntax.colors.variable,'rgb(156, 220, 254)');
assert.equal(syntax.colors.type,'rgb(78, 201, 176)');
assert.equal(new Set(Object.values(syntax.colors)).size,7);
// Exercise completion through the real keyboard binding and persisted idle checks.
await page.evaluate(()=>{
 const editor=document.getElementById('input_editor').env.editor;
 editor.setValue('entry main() {\n    print\n}',-1);
 editor.gotoLine(2,9); editor.focus();
});
await page.keyboard.press('Control+Space');
await page.waitForSelector('.ace_autocomplete');
assert.match((await page.locator('.ace_autocomplete').innerText()).replace(/\s/g, ''), /println/);
await page.keyboard.press('Enter');
const inserted = await page.evaluate(()=>{
 const editor=document.getElementById('input_editor').env.editor;
 return { line:editor.session.getLine(1), cursor:editor.getCursorPosition() };
});
assert.equal(inserted.line.trim(),'println()');
assert.equal(inserted.cursor.column, inserted.line.indexOf(')'),'Cursor is inside argument parentheses');
await page.keyboard.type('"hello"');
assert.equal(await page.evaluate(()=>document.getElementById('input_editor').env.editor.session.getLine(1).trim()),'println("hello")');
await page.keyboard.press('Escape');
const receiverSuggestions = async source => page.evaluate(source => {
 const editor=document.getElementById('input_editor').env.editor;
 editor.setValue(source,-1); editor.navigateFileEnd();
 return new Promise(resolve=>editor.completers[0].getCompletions(editor,editor.session,editor.getCursorPosition(),source.match(/\w*$/)[0],(_error,items)=>resolve(items)));
}, source);
const stringMethods=await receiverSuggestions('entry main(message: string) { message.');
assert.ok(stringMethods.length>0, 'Typed string receiver has methods');
assert.ok(stringMethods.every(item=>item.caption!=='println'), 'Global functions excluded after dot');
assert.deepEqual(await receiverSuggestions('entry main() { unknown.'),[], 'Unknown receiver must not show unrelated methods');
assert.deepEqual(await receiverSuggestions('entry first(message: string) {} entry second() { message.'),[], 'Variables do not leak between functions');
const variableMatches=await receiverSuggestions('fn add(left: Ciphertext, right: Ciphertext) -> Ciphertext { println(left');
assert.deepEqual(variableMatches.map(item=>item.value),['left'],'Argument names in function signatures must not match the variable prefix');
assert.equal(variableMatches[0].snippet,undefined,'Variables insert without parentheses');
const zeroMatches=await receiverSuggestions('fn unique_zero() {} entry main() { unique_z');
assert.equal(zeroMatches[0].snippet,'unique_zero()$0','No-argument functions leave cursor after parentheses');
await page.locator('#btn_editor_options').click();
await page.locator('#auto-compile').check();
await page.locator('#auto-compile-delay').selectOption('1000');
await page.keyboard.press('Escape');
await page.evaluate(()=>document.getElementById('input_editor').env.editor.setValue('entry main() { return 0; }',-1));
await page.waitForFunction(()=>document.querySelector('#editor-check-status').dataset.state==='success');
assert.equal(await page.locator('#app').getAttribute('data-mobile-view'),'code');
await page.evaluate(()=>document.getElementById('input_editor').env.editor.setValue('entry main() { invalid syntax here }',-1));
await page.waitForFunction(()=>document.querySelector('#editor-check-status').dataset.state==='error');
await page.reload();
await page.waitForSelector('#runtime-status[data-state="ready"]');
await page.locator('#btn_editor_options').click();
assert.equal(await page.locator('#auto-compile').isChecked(), true);
assert.equal(await page.locator('#auto-compile-delay').inputValue(), '1000');
await page.locator('#auto-compile').uncheck();
await page.keyboard.press('Escape');
await page.evaluate(()=>document.getElementById('input_editor').env.editor.setValue('entry main() { return 0; }',-1));

async function report(name,width){
 await page.waitForTimeout(100);
 const results=await page.evaluate(()=>{
  const active=Array.from(document.querySelectorAll('#dialog-layer > *')).filter(e=>e.getClientRects().length);
  return {page:[document.documentElement.scrollWidth,innerWidth,document.documentElement.scrollHeight,innerHeight],dialog:active.map(e=>({id:e.id,rect:e.querySelector('.panel_body,.modal-frame').getBoundingClientRect().toJSON()})),overflow:active.flatMap(e=>Array.from(e.querySelectorAll('*')).filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+3&&getComputedStyle(el).overflowX==='visible'&&getComputedStyle(el).display!=='inline').slice(0,15).map(el=>({id:el.id,cl:el.className,tag:el.tagName,w:el.clientWidth,sw:el.scrollWidth})))};
 });
 assert.equal(results.page[0],results.page[1],`${width} ${name}: page width`);
 assert.equal(results.page[2],results.page[3],`${width} ${name}: page height`);
 assert.deepEqual(results.overflow,[],`${width} ${name}: content overflow`);
 for (const {rect} of results.dialog) {
  assert.ok(rect.left>=0 && rect.right<=results.page[1] && rect.top>=0 && rect.bottom<=results.page[3], `${name}: dialog must fit viewport`);
 }
 console.log(`Passed ${width}px: ${name}`);
}
for(const [width,height] of [[1440,900],[1024,800],[960,800],[820,800],[768,800],[580,800],[390,800],[320,568],[844,390]]) {
 await page.setViewportSize({width,height});
 for(const id of ['contract','documentation','rpcinspector','account']) {
  await page.locator('#btn_mode_'+id).click();
  await report(id,width);
  const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('#screen_right *')).filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+3&&getComputedStyle(el).overflowX==='visible'&&getComputedStyle(el).display!=='inline').map(el=>el.id||el.className));
  assert.deepEqual(overflow,[],`${width}px ${id}: panel overflow`);
 }
}
await page.locator('#btn_mode_contract').click();
for(const width of [1440,390,320]){
 await page.setViewportSize({width,height:800});
 await page.locator('#btn_editor_project').click();
 await report('projects',width);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#btn_editor_compile').isEnabled(),true);
 await page.locator('#btn_editor_options').click();
 await report('settings',width);
 await page.locator('#editor-tabsize-menu .menu-stat-ro').focus();
 await page.keyboard.press('Enter');
 await report('settings menu',width);
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('inert'));
 if(width<960)await page.locator('[data-view="code"]').click();
 await page.locator('#btn_editor_save_code').click();
 await report('save',width);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>document.getElementById('input_editor').env.editor.setValue('entry main(message: string) { println(message); return 0; }',-1));
 await page.locator('#btn_editor_compile').click();
 await page.locator('#edit-entry-params-btn').click();
 await report('arguments',width);

 await page.locator('#parameter_builder_container input').first().fill('Responsive test');
 await page.keyboard.press('Escape');
 await page.locator('#btn_configure_deposits').click();
 await page.locator('#btn_add_deposit').click();
 await report('deposits',width);
 await page.locator('#btn_deposits_clear').click();
 await page.keyboard.press('Escape');
 await page.locator('#hud-storage-preset-map-selected').click();
 await page.getByText('Map Editor ...',{exact:true}).click();
 await report('storage',width);
 await page.keyboard.press('Escape');
 if(width<960)await page.locator('[data-view="code"]').click();
 await page.locator('#btn_export').click();
 await report('export',width);
 for(const id of ['hex','bytes','json','abi','asm'])await page.locator('#tab_export_'+id).click();
 await page.keyboard.press('Escape');
 await page.locator('#btn_mode_contract').click();
 await page.locator('#btn_run').click();
 await page.waitForFunction(()=>document.querySelector('#output').textContent.includes('Exit value: 0'));
 assert.match(await page.locator('#output').innerText(),/Responsive test/);
}
assert.deepEqual(errors,[], 'No browser exceptions');
console.log('Responsive layout, dialogs, exports and compile/run checks passed.');
} finally { await browser?.close(); server.kill(); }
