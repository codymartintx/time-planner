import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const seed = JSON.parse(html.match(/id="planner-data">([\s\S]*?)<\/script>/)[1]);
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const builder = fs.readFileSync(new URL('builder.html', root), 'utf8');
const builderContext = {crypto:crypto.webcrypto, structuredClone, TextDecoder, Uint8Array, atob, Date};
vm.createContext(builderContext);
vm.runInContext(builder.match(/<script data-builder-engine>([\s\S]*?)<\/script>/)[1], builderContext);
builderContext.encoded = builder.match(/id="planner-template">([\s\S]*?)<\/script>/)[1];
const builderRead = expression => vm.runInContext(expression, builderContext);
builderRead('var template=PlannerBuilder.readTemplate(encoded)');

function planner(draft = null, data = seed) {
  const nodes = new Map(), storage = new Map();
  const element = () => ({textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,scrollLeft:0,addEventListener(){},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){},close(){}});
  const get = id => {if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  get('planner-data').textContent = JSON.stringify(data);
  const cols = Array.from({length:12},element);
  if (draft) storage.set('time-planner:'+data.docId, JSON.stringify(draft));
  const context = {document:{addEventListener(){},getElementById:get,querySelector:get,querySelectorAll:s=>s==='#log col'?cols:[],createElement:element},window:{addEventListener(){}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
  vm.createContext(context);vm.runInContext(script,context);
  return {context,get,storage,read:expression=>vm.runInContext(expression,context)};
}
const app = planner();
const round = value => Math.round(value*1e8)/1e8;
// Independently transcribed from the supplied image, including existing aliases.
const groups = [
  {formations:['JM','MSS','MS','LSS','Dean'],tih:7,rates:[8500,8500,8000,7500,6000]},
  {formations:['WCA','WFMP A1','WFMP A2','WFMP A3'],tih:7,rates:[8500,8500,8500,7500,7000]},
  {formations:['WCB','WFMP B1','WFMP B2','WFMP B3'],tih:7,rates:[8500,8500,8500,7500,7000]},
  {formations:['WCC','WCD','WFMP D','Barnett','Woodford'],tih:3,rates:[12500,12500,10000,7500,5500]}
];
const tooh = [9.3,9.3,10.8,11.9,14];
const limits = [8500,11500,13500,17500];
const lengths = [8000,...limits.flatMap(limit=>[limit-0.01,limit,limit+0.01]),20000];
assert.deepEqual(JSON.parse(builderRead('JSON.stringify(template.seed.refs)')), seed.refs);
assert.equal(seed.refs.length,groups.flatMap(group=>group.formations).length);
for (const group of groups) for (const formation of group.formations) {
  const ref = seed.refs.find(ref=>ref.formation===formation);
  assert.deepEqual(ref,{formation,tih:group.tih,tooh,rates:group.rates});
  for (const lateral of lengths) for (const splitString of [false,true]) {
    const band = limits.filter(limit=>lateral>=limit).length;
    const setup = {formation,lateral,pre:8,post:8,phaseSelections:{tih:{splitString},toh:{splitString}}};
    const addition = splitString?0.75:0;
    const expected = [8,group.tih+addition,round(lateral/group.rates[band]*24),tooh[band]+addition,24,8];
    app.context.setup = setup;builderContext.setup = setup;
    const actual = app.read('calculateTargets(setup)');
    assert.equal(actual.rate,group.rates[band],formation+' at '+lateral+' ft');
    assert.deepEqual(Array.from(actual.values),expected);
    assert.deepEqual(Array.from(builderRead('PlannerBuilder.phaseTargets(template.seed,setup)')),expected);
  }
}
assert.equal(app.read('Math.round(performance(derive().flat()).target*1e8)/1e8'),84.98988235);
assert.equal(app.read('performance(derive().flat()).forecast'),102.25);
for (const index of [1,2,3]) assert(Math.abs(app.read(`state.phases[${index}].rows.reduce((sum,row)=>sum+row.target,0)-phaseTarget(state.phases[${index}])`))<1e-7);

// Restoring older references updates only the three requested target phases.
const draft = JSON.parse(app.read('JSON.stringify(state)'));
delete draft.targetReference.revision;
draft.updated = Date.now()+1000;
draft.refs.forEach(ref=>{ref.tih=99;ref.tooh=[99,99,99,99,99];ref.rates=[1,1,1,1,1]});
draft.phases.forEach(phase=>phase.rows.forEach(row=>{row.target=99;row.com+=' Keep draft comment';row.logistics='Keep reminder'}));
// An extra well with a repeated TOH phase checks independent setups and empty budgets.
const second = {id:'second-well',title:'Second well',setup:{formation:'Woodford',lateral:18000,pre:4,post:6,phaseSelections:{tih:{splitString:true},toh:{splitString:true}}}};
draft.wells.push(second);
draft.phases.push({id:'extra-toh',wellId:second.id,type:'Trip Out of Hole',name:'TOH',mode:'duration',rows:[{id:'extra-row',duration:2,target:99,com:'Keep second-well note'}]});
draft.phases.push({id:'empty-drill',wellId:second.id,type:'Drill Out',name:'Drill Out',mode:'duration',rows:[]});
const restored = planner(draft);
restored.get('restoreDraft').onclick();
assert.deepEqual(JSON.parse(restored.read('JSON.stringify(state.refs)')),seed.refs);
assert.equal(restored.read('state.targetReference.revision'),seed.targetReference.revision);
assert.equal(restored.read('state.phases.at(-2).rows[0].target'),14.75);
assert.equal(restored.read('state.phases.at(-2).rows[0].targetWeightHours'),2);
assert.equal(restored.read('phaseTarget(state.phases.at(-1))'),round(18000/5500*24));
const after = JSON.parse(restored.read('JSON.stringify(state.phases)'));
after.forEach((phase,index)=>phase.rows.forEach((row,rowIndex)=>{
  const original = draft.phases[index].rows[rowIndex];
  if ([1,2,3,6].includes(index)) {
    const {target,targetWeightHours,...unchanged} = row;
    const {target:oldTarget,targetWeightHours:oldWeight,...before} = original;
    assert.deepEqual(unchanged,before,'Targets preserve timing, operations and comments');
  } else assert.deepEqual(row,original,'Unchanged phase budgets retain manual targets');
}));
assert.equal(JSON.parse(restored.storage.get('time-planner:'+seed.docId)).targetReference.revision,seed.targetReference.revision);
restored.read('state.phases[1].rows[0].target=123');
assert.equal(restored.read('applyTargetReferenceUpdate()'),false);
assert.equal(restored.read('state.phases[1].rows[0].target'),123,'The migration runs once; later manual targets remain editable');
const saved = JSON.parse(restored.read('JSON.stringify(state)'));
const reopened = planner(null,saved);
assert.equal(reopened.read('state.phases[1].rows[0].target'),123);
assert.equal(reopened.read('calculateTargets(state.wells[1].setup).rate'),5500);
console.log('PASS: Midland targets match the image for every formation, alias and lateral boundary in both apps, with split additions, row allocation and older-draft preservation.');
