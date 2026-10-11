import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../builder.html',import.meta.url),'utf8');
const nodes=new Map();
function get(id){
  if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,events:{},addEventListener(type,callback){this.events[type]=callback},querySelector(){return null},click(){this.clicked=true}});
  return nodes.get(id);
}
get('wellCount').value='1';
get('planner-template').textContent=html.match(/id="planner-template">([\s\S]*?)<\/script>/)[1];
let createdBlob;
const context={crypto:{getRandomValues:values=>crypto.webcrypto.getRandomValues(values)},structuredClone,TextDecoder,Uint8Array,atob,Date,Blob,URL:{createObjectURL(blob){createdBlob=blob;return 'blob:test-planner'},revokeObjectURL(){}},document:{getElementById:get,querySelector:get}};
vm.createContext(context);
vm.runInContext(html.match(/<script data-builder-engine>([\s\S]*?)<\/script>/)[1],context);
vm.runInContext(html.match(/<script data-builder-ui>([\s\S]*?)<\/script>/)[1],context);
const read=expression=>vm.runInContext(expression,context);
const change=(well,key,value)=>get('wellFields').events.input({target:{dataset:{well:String(well),key},value}});

assert(get('wellFields').innerHTML.includes('Snub?'));
assert(get('wellFields').innerHTML.includes('Kill method'));
assert.equal(get('phase-count-0-0').textContent,'· 8 rows');
assert.equal(get('phase-count-0-1').textContent,'· 5 rows');
assert.equal(get('phase-count-0-2').textContent,'· 3 rows');
assert.equal(get('phase-count-0-3').textContent,'· 1 row');
assert(get('phase-preview-0-0').innerHTML.includes('Measured &amp; MU BHA'));
change(0,'wlPackerEspCatch','yes');
change(0,'motorBha','yes');
assert(get('phase-preview-0-0').innerHTML.includes('Make up and function test BHA'));
assert(!get('phase-preview-0-0').innerHTML.includes('Measured &amp; MU BHA'));
assert.equal(get('phase-count-0-1').textContent,'· 5 rows');

change(0,'tohKill','Top Kill');
assert(get('phase-preview-0-3').innerHTML.includes('Top kill with'));
change(0,'tohSnub','yes');
assert.equal(get('phase-count-0-3').textContent,'· 4 rows');
assert(!get('phase-preview-0-3').innerHTML.includes('Top kill with'));
assert(get('phase-preview-0-3').innerHTML.includes('Snub remaining jts OH.'));
assert.equal(get('[data-well="0"][data-key="tohKill"]').disabled,true);
change(0,'tohSnub','no');
assert.equal(get('[data-well="0"][data-key="tohKill"]').disabled,false);
assert(get('phase-preview-0-3').innerHTML.includes('Top kill with'));
change(0,'tohSnub','yes');

get('wellCount').value='2';get('wellCount').events.input();
assert.equal(get('phase-count-1-0').textContent,'· 8 rows');
assert.equal(get('phase-count-1-1').textContent,'· 5 rows');
assert.equal(get('phase-count-1-3').textContent,'· 1 row');
assert.equal(get('[data-well="1"][data-key="tohKill"]').disabled,false);
get('rig').value='Ingredient test rig';get('jobStart').value='2026-10-03T06:00';
for(let well=0;well<2;well++)for(const [key,value]of Object.entries({title:'Ingredient well '+(well+1),formation:'LSS',lateral:'10000',spacing:'200',plugs:'50',production:'HPGL'}))change(well,key,value);
get('builderForm').events.submit({preventDefault(){}});
assert.equal(get('error').hidden,true);
assert.equal(get('created').hidden,false);
assert.equal(get('downloadPlanner').clicked,true);
const downloaded=await createdBlob.text();
const state=JSON.parse(downloaded.match(/id="planner-data">([\s\S]*?)<\/script>/)[1]);
assert.equal(state.wells[0].setup.phaseSelections.setProduction.wlPackerEspCatch,true);
assert.equal(state.wells[1].setup.phaseSelections.setProduction.wlPackerEspCatch,false);
assert(get('wellFields').innerHTML.includes('WL for Packer or ESP Catch?'));
assert(get('wellFields').innerHTML.includes('4.0 hrs for well swap; 8.0 hrs for last well on pad'));
assert.equal(state.phases[3].rows.length,4);
assert.equal(state.phases[9].rows.length,1);
assert.equal(state.phases[0].rows.at(-1).ingredientRow,15);
assert.equal(state.phases[6].rows.at(-1).ingredientRow,14);
assert.equal(state.phases[2].rows[1].ingredientRow,27);
assert.equal(state.phases[8].rows[1].ingredientRow,27);
assert.equal(read('activeWells()[0].phaseSelections.toh.killMethod'),'Top Kill');
console.log('PASS: actual builder UI handlers update previews, restore kill selection after snubbing, keep well choices independent and download the selected rows.');


assert(!get('wellFields').innerHTML.includes('Aphron'));
assert(!get('wellFields').innerHTML.includes('Split String'));

const wellMarkup=get('wellFields').innerHTML;
const firstPreview=wellMarkup.indexOf('<details class="timelog-preview">');
for(const key of ['preFirst','motorBha','tohSnub','tohKill','post','production']){
 assert(wellMarkup.indexOf('data-key="'+key+'"')<firstPreview,'Well inputs precede the preview');
 assert.equal((wellMarkup.match(new RegExp('data-well="0" data-key="'+key+'"','g'))||[]).length,1);
}
assert.equal((wellMarkup.match(/<details /g)||[]).length,2,'One collapsible preview per well');
assert(!wellMarkup.includes('class="phase-config"'));
assert(get('phase-preview-0-0').innerHTML.includes('W01 Well Control Readiness checklists'));

// Exercise the complete UI on LAN HTTP, where crypto.randomUUID is unavailable.
const ids=[state.docId,...state.wells.map(w=>w.id),...state.phases.flatMap(p=>[p.id,...p.rows.map(r=>r.id)])];
assert.equal(new Set(ids).size,ids.length);
assert(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
