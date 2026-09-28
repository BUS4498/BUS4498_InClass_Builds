import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('terminal runs without rankings show their outcome and logged exclusions, never in-progress copy',()=>{
 class Node{constructor(){this.children=[];this.textContent='';}append(...xs){this.children.push(...xs);}prepend(...xs){this.children.unshift(...xs);}}
 const context={window:{},document:{createElement:()=>new Node()},URL};vm.runInNewContext(fs.readFileSync(new URL('../app/static/g3.js',import.meta.url),'utf8'),context);
 const text=n=>[n.textContent,...n.children.map(text)].join(' '),render=context.window.CareerFitView.render;
 const candidates=[{disposition:'excluded_unchanged',reason:'Posting content has not changed.',url:'https://example.com/job'}];
 assert.match(text(render({status:'complete',candidates})),/All 1 postings were unchanged/);assert.match(text(render({status:'complete',candidates})),/excluded unchanged/);assert.doesNotMatch(text(render({status:'complete',candidates})),/in progress/);
 assert.match(text(render({status:'incomplete',candidates:[]})),/No completed fit ranking/);assert.match(text(render({status:'running',candidates:[]})),/in progress/);
});
