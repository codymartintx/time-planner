import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=html.match(/id="planner-data">([\s\S]*?)<\/script>/)[1];
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const nodes=new Map();let phaseHeaders=[],summaries=[],reminders=[],footers=[];
function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},children:[],scrollTop:0,scrollLeft:0,attributes:{},addEventListener(k,f){(this.listeners[k]??=[]).push(f)},setAttribute(k,v){this.attributes[k]=v},removeAttribute(){},appendChild(c){this.children.push(c)},querySelector(s){return s==='.column-resizer'?this.children.find(c=>c.className==='column-resizer')??null:null},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
let rowsHtml='';Object.defineProperty(get('rows'),'innerHTML',{get:()=>rowsHtml,set:v=>{
 rowsHtml=v;
 phaseHeaders=[...v.matchAll(/<tr class="column-headings phase-column-headings"[^>]*>[\s\S]*?<\/tr>/g)].map(m=>{
  const row=element();row.children=[...m[0].matchAll(/<th\b[^>]*>[\s\S]*?<\/th>/g)].map(()=>element());return row;
 });
 summaries=[...v.matchAll(/class="phase-summary"/g)].map(()=>element());
 reminders=[...v.matchAll(/class="phase-reminders-group"/g)].map(()=>element());
 footers=[...v.matchAll(/class="phase-section-foot"/g)].map(()=>element());
}});
get('planner-data').textContent=data;const cols=Array.from({length:12},element);
const handles=()=>phaseHeaders.flatMap(r=>r.children.flatMap(h=>h.children));
const document={addEventListener(){},getElementById:get,querySelector:get,createElement:element,querySelectorAll:s=>({
 '#log col':cols,'#log .phase-column-headings':phaseHeaders,'#log .column-headings, #log tbody tr[data-id]':phaseHeaders,
 '#log .phase-summary':summaries,'#log .phase-reminders-group':reminders,'#log .phase-section-foot td':footers,'.column-resizer':handles()
 }[s]??[])};
const context={document,window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
vm.createContext(context);vm.runInContext(script,context);const read=x=>vm.runInContext(x,context);
assert(!html.includes('<tr class="letters"'));assert.equal((html.match(/id="selectAll"/g)||[]).length,0);
assert.equal(phaseHeaders.length,6);assert(phaseHeaders.every(r=>r.children.length===12));assert.equal(handles().length,66);
assert.equal(get('jobTitle').textContent,'Example Rig 1; Midland Basin 1H');
for(let i=0;i<6;i++){
 const section=rowsHtml.slice(rowsHtml.indexOf(`id="phase-section-${i}"`));
 assert(section.indexOf('Current Phase Total')<section.indexOf('phase-column-headings'));
 assert.equal(summaries[i].colSpan,10);assert.equal(reminders[i].colSpan,2);assert.equal(footers[i].colSpan,12);
}
const keyResize=phaseHeaders[3].children[10].children[0];
keyResize.listeners.keydown[0]({key:'ArrowRight',preventDefault(){}});
assert.equal(read('state.columnWidths[10]'),250);assert.equal(cols[10].style.width,'250px');
assert(phaseHeaders.every(r=>Number(r.children[10].children[0].attributes['aria-valuenow'])===250));
phaseHeaders[5].children[10].children[0].listeners.dblclick[0]({preventDefault(){}});
assert.equal(read('state.columnWidths[10]'),240);
read("state.hiddenColumns=['code','logistics'];render()");
assert(summaries.every(s=>s.colSpan===9));assert(reminders.every(s=>s.colSpan===1));
assert(phaseHeaders.every(r=>r.children[8].style.display==='none'&&r.children[10].style.display==='none'));
read("state.hiddenColumns=['logistics','sshe'];render()");assert(reminders.every(s=>s.style.display==='none'));
read('state.hiddenColumns=[];active=1;insert(1)');assert.equal(handles().length,66);assert.equal(phaseHeaders.length,6);
get('undoBtn').onclick();assert.equal(read('state.phases[1].rows.length'),3);assert.equal(handles().length,66);
get('setupBtn').onclick();assert(get('setupFields').innerHTML.includes('name="rig"'));
context.FormData=class{constructor(v){this.v=v}get(k){return this.v[k]??null}};
get('setupForm').onsubmit({preventDefault(){},target:{title:'Test Well',rig:'  Ranger 9999  ',start:'2026-09-23T06:00',formation:'LSS',lateral:'10161',spacing:'203',plugs:'50',pre:'8',post:'8'}});
assert.equal(read('state.setup.rig'),'Ranger 9999');assert.equal(read('state.title'),'Test Well');
assert.equal(get('jobTitle').textContent,'Ranger 9999; Test Well');assert.equal(document.title,'Ranger 9999; Test Well · Time Planner');
assert.equal(get('setupScoreboard').innerHTML,get('scoreboard').innerHTML);
get('undoBtn').onclick();assert.equal(get('jobTitle').textContent,'Example Rig 1; Midland Basin 1H');
read("delete state.setup.rig;render()");assert.equal(get('jobTitle').textContent,'Midland Basin 1H');
console.log('PASS: phase headings before named columns; no letter row; per-phase resize controls survive insert/Undo and hide/show; optional rig title updates with setup; matching attainment views.');

const olderDraft=JSON.parse(data);delete olderDraft.setup.rig;olderDraft.updated=Date.now()+1000;olderDraft.phases[0].rows[0].duration=5;
context.localStorage.getItem=()=>JSON.stringify(olderDraft);
const restoreScript=script.match(/try\{const draft=JSON.parse\(localStorage.getItem[\s\S]*?\}\}catch\{\}/)[0];
vm.runInContext(restoreScript,context);get('restoreDraft').onclick();
assert.equal(read('state.phases[0].rows[0].duration'),5);assert.equal(read('state.setup.rig'),'Example Rig 1');
console.log('PASS: restoring an older browser draft retains its edits and supplies the new rig field.');
