import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const nodes=new Map();
function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,scrollLeft:0,addEventListener(){},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=html.match(/id="planner-data">([\s\S]*?)<\/script>/)[1];
const cols=Array.from({length:12},element),storage=new Map();
const context={document:{addEventListener(){},getElementById:get,querySelector:get,querySelectorAll:s=>s==='#log col'?cols:[],createElement:element},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem:(key,value)=>storage.set(key,value)},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
vm.createContext(context);vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],context);
const read=expression=>vm.runInContext(expression,context);
read("state.phases.forEach(phase=>phase.rows.forEach(row=>{row.logistics='Keep logistics';row.sshe='Keep safety note'}));render()");
const baseline=JSON.parse(read('JSON.stringify(state)'));
const durations=JSON.parse(read('JSON.stringify(derive().flat().map(row=>[row.id,row.computedDuration]))'));
const total=read('performance(derive().flat()).forecast');
const phaseIds=baseline.phases.map(phase=>phase.id);
assert.equal((get('rows').innerHTML.match(/data-action="delete-phase"/g)||[]).length,6);
function clickDelete(index){
 const button={dataset:{action:'delete-phase'},closest:()=>({dataset:{phaseIndex:String(index)}})};
 get('rows').onclick({target:{closest:()=>button}});
}
for(const index of [0,2,3,5]){
 const deleted=baseline.phases[index];
 const removedHours=deleted.rows.reduce((sum,row)=>sum+durations.find(([id])=>id===row.id)[1],0);
 const removedTarget=deleted.rows.reduce((sum,row)=>sum+row.target,0);
 const target=read('performance(derive().flat()).target');
 read('active='+index);clickDelete(index);
 assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases.map(phase=>phase.id))')),phaseIds.filter(id=>id!==deleted.id));
 for(const row of JSON.parse(read('JSON.stringify(derive().flat())'))){
  assert.equal(row.computedDuration,durations.find(([id])=>id===row.id)[1]);assert.equal(row.error,'');
  const original=baseline.phases.flatMap(phase=>phase.rows).find(original=>original.id===row.id);
  for(const key of ['target','category','desc','code','com','logistics','sshe'])assert.equal(row[key],original[key]);
 }
 assert.equal(read('performance(derive().flat()).forecast'),total-removedHours);
 assert(Math.abs(read('performance(derive().flat()).target')-(target-removedTarget))<1e-7);
 assert(read('active>=0&&active<state.phases.length'));
 assert(!get('tabs').innerHTML.includes(`<strong>${deleted.name}</strong>`));
 assert.equal(JSON.parse(storage.get('time-planner:'+baseline.docId)).phases.length,5,'Deletion persists in the browser draft');
 get('undoBtn').onclick();
 assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases)')),baseline.phases,'Undo restores rows, reminders and original dates');
}
// A collapsed phase can be deleted without expanding it first.
read('state.phases[2].collapsed=true;render()');
clickDelete(2);assert.equal(read('state.phases.length'),5);get('undoBtn').onclick();
assert.equal(read('state.phases[2].collapsed'),true);
read('state.phases[2].collapsed=false;render()');

// Only the chosen well loses the phase; later date-mode work keeps its duration.
read("const second={...structuredClone(state.wells[0]),id:newId(),title:'Second well'};state.wells.push(second);state.phases.push(...state.phases.map(phase=>({...structuredClone(phase),id:newId(),wellId:second.id,rows:phase.rows.map(row=>({...structuredClone(row),id:newId()}))})));setAllTimeModes('duration');setAllTimeModes('date');render()");
const multi=JSON.parse(read('JSON.stringify(state.phases)'));
const multiDurations=JSON.parse(read('JSON.stringify(derive().flat().map(row=>[row.id,row.computedDuration]))'));
clickDelete(8);
assert.equal(read('state.phases.length'),11);
assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases.slice(0,6))')),multi.slice(0,6));
for(const row of JSON.parse(read('JSON.stringify(derive().flat())')))assert.equal(row.computedDuration,multiDurations.find(([id])=>id===row.id)[1]);
get('undoBtn').onclick();assert.deepEqual(JSON.parse(read('JSON.stringify(state.phases)')),multi);
// Recorded loader starts remain fixed when a preceding phase is deleted.
context.baseline=baseline;
read("state=structuredClone(baseline);history=[];setAllTimeModes('duration');state.phases[2].rows[0].loaderStart=iso(derive()[2][0].start);setAllTimeModes('date');render()");
const recordedStart=read('state.phases[2].rows[0].loaderStart');
const recordedDurations=JSON.parse(read('JSON.stringify(derive().flat().map(row=>[row.id,row.computedDuration]))'));
clickDelete(1);
assert.equal(read('state.phases[1].rows[0].loaderStart'),recordedStart);
for(const row of JSON.parse(read('JSON.stringify(derive().flat())'))){assert.equal(row.computedDuration,recordedDurations.find(([id])=>id===row.id)[1]);assert.equal(row.error,'');}
get('undoBtn').onclick();
// Empty phases and deleting the last phase leave the well available for new work.
read("state.phases=[{...state.phases[0],rows:[]}];history=[];active=0;render()");
clickDelete(0);assert.equal(read('state.phases.length'),0);assert.equal(read('state.wells.length'),1);
assert(get('rows').innerHTML.includes('data-action="new-phase"'));
assert.equal(read('active'),0);
get('undoBtn').onclick();assert.equal(read('state.phases.length'),1);
read('deletePhase(-1);deletePhase(99);deletePhase(0.5)');assert.equal(read('state.phases.length'),1);
console.log('PASS: phase deletion updates timing/targets/drafts, keeps all surviving durations and notes, supports collapsed/empty/last phases and multiple wells, and Undo restores exact dates and rows.');
