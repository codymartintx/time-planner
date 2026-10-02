import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=html.match(/<script type="application\/json" id="planner-data">([\s\S]*?)<\/script>/)[1];
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const nodes=new Map();
function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},scrollTop:0,scrollLeft:0,addEventListener(k,f,c){(this.listeners[k]??=[]).push({f,c})},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=data;
const cols=Array.from({length:12},element),storage=new Map(),warnings=[];
let answer=true;
const document={addEventListener(){},getElementById:get,querySelector:get,querySelectorAll:s=>s==='#log col'?cols:[],createElement:element};
const context={document,window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:message=>{warnings.push(message);return answer},FormData:class{constructor(form){this.form=form}get(key){return this.form[key]??null}}};
vm.createContext(context);vm.runInContext(script,context);
const read=expr=>vm.runInContext(expr,context);
const baseline=JSON.parse(read('JSON.stringify(state)'));
assert.equal(read('state.wells.length'),1);
assert.equal(read('state.phases.length'),6);
assert.equal(read('new Set(state.phases.map(p=>p.wellId)).size'),1);
assert.equal(read('performance(derive().flat()).forecast'),102.25);
assert.equal(read('performance(derive().flat()).target.toFixed(2)'),'98.52');

// Setup count adds independent fields and preserves the original example.
get('setupBtn').onclick();
assert(get('setupFields').innerHTML.includes('name="wellCount"'));
const form={title:baseline.title,rig:baseline.setup.rig,start:baseline.setup.start,formation:'LSS',lateral:'10161',spacing:'203',plugs:'50',pre:'8',post:'8',wellCount:'3'};
get('setupForm').onchange({currentTarget:form,target:{name:'wellCount'}});
assert(get('setupFields').innerHTML.includes('name="well1_formation"'));
assert(get('setupFields').innerHTML.includes('name="well2_lateral"'));
Object.assign(form,{well1_title:'Second well',well1_formation:'WCC',well1_lateral:'9000',well1_spacing:'200',well1_plugs:'45',well1_pre:'8',well1_post:'8',well2_title:'Third well',well2_formation:'WCA',well2_lateral:'18000',well2_spacing:'200',well2_plugs:'90',well2_pre:'8',well2_post:'8'});
get('setupForm').onsubmit({preventDefault(){},target:form});
assert.equal(read('state.wells.length'),3);
assert.equal(read('state.phases.length'),18);
assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases.slice(0,6).map(p=>p.rows))')),baseline.phases.map(p=>p.rows));
assert.equal(read('state.wells[1].setup.formation'),'WCC');
assert.equal(read('targets().values[7]'),3);
assert.equal(read('targets().values[8]'),21.6);
assert.equal(read('targets().values[9]'),9);
assert.equal(read('targets().values[14]'),61.71428571);
assert.equal((get('rows').innerHTML.match(/class="well-section-head"/g)||[]).length,3);
assert.equal((get('rows').innerHTML.match(/class="column-headings phase-column-headings"/g)||[]).length,18);

// Two more well timelines follow the first with no automatic resets or gaps.
const op=baseline.ops.find(o=>o.code==='NUND_BOP');
context.op=op;
read("state.phases.slice(6).forEach((p,i)=>p.rows=[{...newRow(),...op,duration:i<6?1:2,target:1,com:'Well-specific entry '+i}]);render()");
assert.equal(read('derive()[6][0].start'),read('derive()[5].at(-1).computedEnd'));
assert.equal(read('derive()[12][0].start'),read('derive()[11].at(-1).computedEnd'));
assert.equal(read('performance(derive().flat()).forecast'),120.25);
const schedule=read('JSON.stringify(derive())');
read('toggleWell(state.wells[1].id)');
assert.equal(read('state.wells[1].collapsed'),true);
assert(!get('rows').innerHTML.includes('data-id="'+read('state.phases[6].rows[0].id')+'"'));
assert.equal(read('JSON.stringify(derive())'),schedule);
read('toggleWell(state.wells[1].id);togglePhase(6)');
assert(!get('rows').innerHTML.includes('data-id="'+read('state.phases[6].rows[0].id')+'"'));
assert.equal(read('JSON.stringify(derive())'),schedule);
read('togglePhase(6)');
read('toggleWell(state.wells[2].id);state=JSON.parse(JSON.stringify(state));render()');
assert.equal(read('state.wells[2].collapsed'),true);
read('toggleWell(state.wells[2].id)');
get('rows').onchange({target:{dataset:{field:'com'},value:'Edited second well',closest:()=>({dataset:{phaseIndex:'6',id:read('state.phases[6].rows[0].id')}})}});
assert.equal(read('state.phases[6].rows[0].com'),'Edited second well');
assert.equal(read('state.phases[0].rows[0].com'),baseline.phases[0].rows[0].com);

// WellView exports only the chosen well, using full events and the same five columns.
read('openWellView()');
assert(read('copyRows.every(r=>r.wellId===state.wells[0].id)'));
get('copyWell').value=read('state.wells[1].id');get('copyWell').onchange();
assert(read('copyDays.flatMap(d=>d.rows).every(r=>r.wellId===state.wells[1].id)'));
assert.equal(read('copyDays.flatMap(d=>d.rows).length'),6);
assert(get('copytext').value.split('\n').every(line=>line.split('\t').length===5));
assert(get('copytext').value.includes('Well-specific entry'));
assert(!get('copytext').value.includes('Ranger 8549'));
read('download=(content,type,name)=>{globalThis.savedDownload={content,type,name}}');get('csvBtn').onclick();
assert(context.savedDownload.content.startsWith('\ufeff"Well","Phase"'));
assert(context.savedDownload.content.includes('"Second well"'));
assert(context.savedDownload.content.includes('"Third well"'));

// Added phase is inserted within the requested well, not after the next well.
read("addPhase(state.wells[1].id,'Drill Out')");
assert.equal(read('state.phases[12].type'),'Drill Out');
assert.equal(read('state.phases[12].wellId'),read('state.wells[1].id'));
assert.equal(read('state.phases[13].wellId'),read('state.wells[2].id'));
assert.equal(read('phaseTarget(state.phases[12])'),21.6);
assert.equal(read('state.phases[12].rows.length'),0);
get('undoBtn').onclick();assert.equal(read('state.phases.length'),18);

// Reducing the count requires confirmation, supports cancellation, and can be undone.
get('setupBtn').onclick();
const smaller={...form,wellCount:'1'};
get('setupForm').onchange({currentTarget:smaller,target:{name:'wellCount'}});
answer=false;get('setupForm').onsubmit({preventDefault(){},target:smaller});
assert.equal(read('state.wells.length'),3);
assert(warnings.at(-1).includes('Reducing the well count'));
answer=true;get('setupForm').onsubmit({preventDefault(){},target:smaller});
assert.equal(read('state.wells.length'),1);assert.equal(read('state.phases.length'),6);
get('undoBtn').onclick();assert.equal(read('state.wells.length'),3);assert.equal(read('state.phases.length'),18);

// Clear removes job data, history, recovery and previous browser draft only after confirmation.
const beforeClear=read('JSON.stringify(state)'),oldId=read('state.docId');
answer=false;assert.equal(read('clearEverything()'),false);assert.equal(read('JSON.stringify(state)'),beforeClear);
answer=true;assert.equal(read('clearEverything()'),true);
assert.equal(read('state.title'),'');assert.equal(read('state.setup.rig'),'');assert.equal(read('state.setup.start'),'');
assert.equal(read('state.phases.length'),0);assert.equal(read('state.wells.length'),1);assert.equal(read('history.length'),0);
assert.equal(read('state.preOpsRecovery'),undefined);assert.equal(read('state.importDetails'),undefined);
assert.notEqual(read('state.docId'),oldId);assert(!storage.has('time-planner:'+oldId));
assert.equal(read('state.ops.length'),baseline.ops.length);assert.equal(read('state.refs.length'),baseline.refs.length);
assert.equal(get('copytext').value,'');assert.equal(read('copyDays.length'),0);
assert(get('rows').innerHTML.includes('No phases yet'));
assert(warnings.at(-1).includes('cannot be undone'));
// Start a genuinely new well and any allowed phase after clearing; it remains blank on reload.
get('setupBtn').onclick();
get('setupForm').onsubmit({preventDefault(){},target:{title:'New job',rig:'Ranger 1',start:'2026-10-01T06:00',formation:'WCA',lateral:'9000',spacing:'200',plugs:'45',pre:'8',post:'8',wellCount:'1'}});
read("addPhase(state.wells[0].id,'Trip in Hole');active=0;insert(0)");
assert.equal(read('state.phases[0].type'),'Trip in Hole');assert.equal(read('state.phases[0].rows.length'),1);
assert.equal(read('state.phases[0].rows[0].com'),'');assert.equal(read('derive()[0][0].start'),read("parseTime('2026-10-01T06:00')"));
assert.equal(read('phaseTarget(state.phases[0])'),9);
assert.equal(read('phasePerformance(state.phases[0],derive()[0]).target'),9);
const saved=read('JSON.stringify(state)');context.saved=saved;
read('state=JSON.parse(saved);render()');
assert.equal(read('state.wells.length'),1);assert.equal(read('state.phases[0].rows.length'),1);
assert.equal(read('applyPreOpsRecovery()'),0);
console.log('PASS: multi-well setup, original data preservation, independent targets, chained schedules, persisted collapses, per-well WellView export, phase insertion, count-reduction warning/Undo, and confirmed clear/start-from-blank.');
