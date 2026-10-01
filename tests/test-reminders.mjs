import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=html.match(/<script type="application\/json" id="planner-data">([\s\S]*?)<\/script>/)[1];
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const nodes=new Map();function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},scrollTop:0,scrollLeft:0,addEventListener(k,f,c){(this.listeners[k]??=[]).push({f,c})},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=data;const cols=Array.from({length:12},element),headers=Array.from({length:12},element);
const document={addEventListener(){},getElementById:get,querySelector:s=>get(s),querySelectorAll:s=>s==='#log col'?cols:s==='#log .letters th'?headers:[],createElement:element};
const context={document,window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
vm.createContext(context);vm.runInContext(script,context);const read=x=>vm.runInContext(x,context);



assert.equal(read('columnKeys.length'),12);
assert.equal(read('state.columnWidths.length'),12);
assert.equal((get('rows').innerHTML.match(/data-field="logistics"/g)||[]).length,51);
assert.equal((get('rows').innerHTML.match(/data-field="sshe"/g)||[]).length,51);
get('setupBtn').onclick();
assert.equal(get('setupScoreboard').innerHTML,get('scoreboard').innerHTML);
assert.equal(get('setupAttainmentSummary').textContent,get('attainmentSummary').textContent);
assert(get('setupScoreboard').innerHTML.includes('98.52'));
const duration=read('performance(derive().flat()).forecast');
const id=read('state.phases[0].rows[0].id');
for(const [field,value]of [['logistics','Confirm delivery\nBefore next phase'],['sshe','Review SSHE & V&V <notes>']]){
 get('rows').onchange({target:{dataset:{field},value,closest:()=>({dataset:{id}})}});
 assert.equal(read(`state.phases[0].rows[0].${field}`),value);
}
assert.equal(read('performance(derive().flat()).forecast'),duration);
assert.equal(get('setupScoreboard').innerHTML,get('scoreboard').innerHTML);
assert(get('rows').innerHTML.includes('SSHE &amp; V&amp;V &lt;notes&gt;'));
read('active=2;insert(1)');
assert.equal(read('state.phases[2].rows.length'),15);
assert.equal(read('state.phases[2].rows[1].logistics'),'');assert.equal(read('state.phases[2].rows[1].sshe'),'');
get('undoBtn').onclick();assert.equal(read('state.phases[2].rows.length'),14);
assert.equal(read('state.phases[0].rows[0].logistics'),'Confirm delivery\nBefore next phase');
const stored=JSON.parse(read('JSON.stringify(state)'));
assert.equal(stored.phases[0].rows[0].sshe,'Review SSHE & V&V <notes>');
// Hide either reminder, then both: group span and sticky positions follow visibility.
read("state.hiddenColumns=['logistics'];render()");assert.equal(cols[10].style.display,'none');assert.equal(cols[11].style.display,'');
read("state.hiddenColumns=['logistics','sshe'];render()");assert.equal(cols[10].style.display,'none');assert.equal(cols[11].style.display,'none');
read("state.hiddenColumns=[];render();showColumnChoices()");assert.equal(cols[10].style.display,'');assert.equal(cols[11].style.display,'');
assert(get('columnChoices').innerHTML.includes('Logistics Cue'));assert(get('columnChoices').innerHTML.includes('SSHE &amp; V&amp;V'));
read("state.columnWidths[10]=325;applyColumnWidths()");assert.equal(cols[10].style.width,'325px');
read('openWellView()');assert.equal(read('copyDays.length'),5);
for(let i=0;i<5;i++){
 get('copyDay').value=String(i);read('selectCopyDay()');
 assert(get('copytext').value.split('\n').every(r=>r.split('\t').length===5));
 assert(!get('copytext').value.includes('Confirm delivery'));assert(!get('copytext').value.includes('Review SSHE'));
}
read("download=(content,type,name)=>{globalThis.savedDownload={content,type,name}};");get('csvBtn').onclick();
assert(context.savedDownload.content.includes('"Logistics Cue","SSHE & V&V"'));
assert(context.savedDownload.content.includes('Confirm delivery\nBefore next phase'));
assert(context.savedDownload.content.includes('Review SSHE & V&V <notes>'));
// Older drafts lacking reminder fields still render with usable widths and blank editors.
read("state=structuredClone(seed);state.columnLayoutVersion=2;state.columnWidths=[24,...defaultColumnWidths.slice(0,10)];state.phases.forEach(p=>p.rows.forEach(r=>{delete r.logistics;delete r.sshe}));render()");
assert.equal(read('state.columnWidths.length'),12);assert.equal(read('state.columnWidths[10]'),240);
assert(!get('rows').innerHTML.includes('undefined'));
console.log('PASS: reminder editing, saved data, independent phase insertion/Undo, resizing/hiding, older draft compatibility, CSV inclusion, five-column daily WellView copy, and shared Setup attainment.');
