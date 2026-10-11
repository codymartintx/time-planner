import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=html.match(/<script type="application\/json" id="planner-data">([\s\S]*?)<\/script>/)[1];
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const nodes=new Map();function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},scrollTop:0,scrollLeft:0,addEventListener(k,f,c){(this.listeners[k]??=[]).push({f,c})},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=data;const cols=Array.from({length:12},element),headers=Array.from({length:12},element);
const tooltipEvents={};const document={addEventListener(k,f){(tooltipEvents[k]??=[]).push(f)},getElementById:get,querySelector:s=>get(s),querySelectorAll:s=>s==='#log col'?cols:s==='#log .letters th'?headers:[],createElement:element};
const context={document,window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
vm.createContext(context);vm.runInContext(script,context);const read=x=>vm.runInContext(x,context);



read("state.phases[3].rows[0].logistics='Book next crew';state.phases[3].rows[0].sshe='Review next phase';render()");
const baseline=JSON.parse(read('JSON.stringify(state)'));
const initialDurations=JSON.parse(read('JSON.stringify(derive().flat().map(r=>[r.id,r.computedDuration]))'));
const initialEnd=read('derive().flat().at(-1).computedEnd');
const initialHours=read('performance(derive().flat()).forecast');
function checkDurations(){const now=JSON.parse(read('JSON.stringify(derive().flat().map(r=>[r.id,r.computedDuration]))'));for(const [id,d] of now){const original=initialDurations.find(r=>r[0]===id);if(original)assert.equal(d,original[1]);}}
function undo(){get('undoBtn').onclick();assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases)')),baseline.phases);assert.equal(read('derive().flat().at(-1).computedEnd'),initialEnd);}
// Row insertion is exposed on each row and works above/below a middle row in
// both input modes without consuming another activity's duration.
function clickRow(action,phaseIndex,id){
 const tr={dataset:{phaseIndex:String(phaseIndex),id}};
 const button={dataset:{action},closest:()=>tr};
 get('rows').onclick({target:{closest:()=>button}});
}
assert.equal((get('rows').innerHTML.match(/class="row-insert"/g)||[]).length,initialDurations.length);
assert(get('rows').innerHTML.includes('data-action="insert-above"'));
for(const phaseIndex of [0,3])for(const action of ['insert','insert-above']){
 const original=baseline.phases[phaseIndex].rows[1];
 clickRow(action,phaseIndex,original.id);
 const position=action==='insert'?2:1;
 assert.equal(read(`state.phases[${phaseIndex}].rows.length`),baseline.phases[phaseIndex].rows.length+1);
 const added=JSON.parse(read(`JSON.stringify(state.phases[${phaseIndex}].rows[${position}])`));
 assert(!initialDurations.some(([id])=>id===added.id));
 assert.equal(added.target,null);assert.equal(added.duration,0);assert.equal(added.com,'');
 assert.equal(read(`derive()[${phaseIndex}][${position}].computedDuration`),0);
 assert(read('derive().flat().every(row=>!row.error)'));
 checkDurations();assert.equal(read('derive().flat().at(-1).computedEnd'),initialEnd);undo();
}
const unchangedHistory=read('history.length');read('active=0;insert(-1);insert(999)');assert.equal(read('history.length'),unchangedHistory);
read("active=0;applyRowTool('down',0)");
assert.equal(read('state.phases[0].rows[1].id'),baseline.phases[0].rows[0].id);checkDurations();assert.equal(read('derive().flat().at(-1).computedEnd'),initialEnd);undo();
const count=read('history.length');read("active=0;applyRowTool('up',0);applyRowTool('down',state.phases[0].rows.length-1)");assert.equal(read('history.length'),count);
read("active=3;applyRowTool('down',0)");checkDurations();assert.equal(read('derive().flat().at(-1).computedEnd'),initialEnd);undo();
read("active=3;applyRowTool('duplicate',0)");
const duplicated=JSON.parse(read('JSON.stringify(state.phases[3].rows[1])'));
const dateDuration=initialDurations.find(r=>r[0]===baseline.phases[3].rows[0].id)[1];
assert.notEqual(duplicated.id,baseline.phases[3].rows[0].id);assert.equal(duplicated.target,null);assert.equal(duplicated.targetWeightHours,null);
assert.equal(duplicated.logistics,'Book next crew');assert.equal(duplicated.sshe,'Review next phase');assert.equal(duplicated.com,baseline.phases[3].rows[0].com);
assert.equal(read('derive()[3][1].computedDuration'),dateDuration);checkDurations();assert.equal(read('performance(derive().flat()).forecast'),initialHours+dateDuration);
assert.equal(read('derive().flat().at(-1).computedEnd'),initialEnd+Math.round(dateDuration*3600000));undo();
read("active=3;applyRowTool('remove',0)");checkDurations();assert.equal(read('performance(derive().flat()).forecast'),initialHours-dateDuration);undo();
read("active=0;applyRowTool('duplicate',0)");checkDurations();assert.equal(read('performance(derive().flat()).forecast'),initialHours+baseline.phases[0].rows[0].duration);
assert.equal(read('state.phases[0].rows[1].target'),null);
read('openWellView()');assert(get('copytext').value.split('\n').every(r=>r.split('\t').length===5));
context.FormData=class{constructor(v){this.v=v}get(k){return this.v[k]??null}};
get('setupForm').onsubmit({preventDefault(){},target:{title:baseline.title,rig:baseline.setup.rig,start:baseline.setup.start,formation:'LSS',lateral:'10161',spacing:'203',plugs:'50',pre:'8',post:'8'}});
assert(read('state.phases[0].rows[1].target>0'));assert.equal(read('Math.round(state.phases[0].rows.reduce((s,r)=>s+r.target,0)*1e8)/1e8'),8);
assert.equal(read('Math.round(performance(derive().flat()).target*1e8)/1e8'),84.98988235);
// Row buttons keep accessible names and no tooltip UI or hover interception.
assert(!html.includes('data-tooltip'));
assert(!html.includes('controlTooltip'));
assert(!get('rows').innerHTML.includes(' title='));
assert(html.includes('.row-actions:hover .rowtools,.row-actions:focus-within .rowtools{display:flex}'));
assert(!html.includes('td:nth-child(1):hover .rowtools'));
const firstCell=get('rows').innerHTML.match(/<tr data-phase-index="0" data-id="[^"]+">(<td[\s\S]*?<\/td>)/)[1];
assert(firstCell.includes('<div class="row-actions"><button class="row-insert"'));
assert.equal((firstCell.match(/data-action="insert"/g)||[]).length,1);
assert(firstCell.includes('<div class="rowtools"><button data-action="insert-above"'));
assert(get('rows').innerHTML.includes('data-action="duplicate"'));assert(!get('rows').innerHTML.includes('data-action="up"'));assert(!get('rows').innerHTML.includes('data-action="down"'));assert(get('rows').innerHTML.includes('class="row-drag" draggable="true"'));assert(get('rows').innerHTML.includes('aria-label="Delete row'));
console.log('PASS: moves stay within phases; date/duration duplicates and deletes preserve other activity durations and shift the schedule; Undo restores rows/times; copied reminders, reviewed targets, and WellView export; persistent + hover/focus controls without tooltips.');

// Drag several positions in both timing modes. All data and durations follow the row.
for(const pi of [0,3]) {
 read('state=structuredClone(seed);history=[];render()');
 const before=JSON.parse(read('JSON.stringify(state.phases)'));
 const durations=JSON.parse(read('JSON.stringify(derive().flat().map(row=>[row.id,row.computedDuration]))'));
 const from=0,to=before[pi].rows.length-1;
 assert(read(`moveRow(${pi},${from},${to})`));
 assert.equal(read(`state.phases[${pi}].rows[${to}].id`),before[pi].rows[0].id);
 const after=JSON.parse(read('JSON.stringify(derive().flat().map(row=>[row.id,row.computedDuration]))'));
 assert.deepEqual(after.sort(),durations.sort());
 get('undoBtn').onclick();assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases)')),before);
}
// Exercise the actual delegated drag/drop handlers and reject cross-phase drops.
read('state=structuredClone(seed);history=[];render()');
const dragIds=Array.from(read('state.phases[0].rows.map(r=>r.id)'));
function dragTr(pi,id){return {dataset:{phaseIndex:String(pi),id},classList:{add(){},remove(){}},getBoundingClientRect(){return {top:0,height:100}}}}
const sourceTr=dragTr(0,dragIds[0]);
const transfer={setData(){}};
const dragStart=()=>get('rows').ondragstart({target:{closest:()=>({closest:()=>sourceTr})},dataTransfer:transfer});
dragStart();
get('rows').ondrop({target:{closest:()=>dragTr(1,read('state.phases[1].rows[0].id'))},clientY:90,preventDefault(){}});
assert.equal(read('history.length'),0);
dragStart();
get('rows').ondrop({target:{closest:()=>dragTr(0,dragIds[3])},clientY:90,preventDefault(){}});
assert.equal(read('state.phases[0].rows[3].id'),dragIds[0]);
get('undoBtn').onclick();assert.deepEqual(Array.from(read('state.phases[0].rows.map(r=>r.id)')),dragIds);
