import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const builder = fs.readFileSync(new URL('builder.html', root), 'utf8');
const engine = builder.match(/<script data-builder-engine>([\s\S]*?)<\/script>/)[1];
const encoded = builder.match(/<script type="text\/plain" id="planner-template">([\s\S]*?)<\/script>/)[1];
const context = {crypto: crypto.webcrypto, structuredClone, TextDecoder, Uint8Array, atob, Date};
vm.createContext(context);vm.runInContext(engine, context);
context.encoded = encoded;
const read = expression => vm.runInContext(expression, context);
read('var template=PlannerBuilder.readTemplate(encoded)');
const template = read('template');
assert(!template.html.includes('Epley Glasscock'), 'Builder template contains no example well');
assert.equal(template.seed.phases.length, 0);
assert.equal(template.seed.preOpsRecovery, undefined);
assert.equal(template.seed.importDetails, undefined);
assert(!/<script[^>]+src=/.test(builder), 'Builder works without remote scripts');
const plannerScript = fs.readFileSync(new URL('index.html', root), 'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
assert.equal(template.html.match(/<script>\s*([\s\S]*?)<\/script>/)[1], plannerScript, 'Embedded planner includes the latest behavior');

context.configuration = {rig:' Ranger 9000 ',start:'2026-10-02T06:00',wells:[
  {title:'First well',formation:'LSS',lateral:10161,spacing:203,plugs:50,post:8,phaseSelections:{preOps:{firstWell:true,splitString:true,motorBha:true},tih:{splitString:true},toh:{splitString:true},setProduction:{method:'HPGL'}}},
  {title:'Second well — B',formation:'WCC',lateral:9000,spacing:200,plugs:45,post:6,phaseSelections:{preOps:{firstWell:false},setProduction:{method:'ESP & ESP-HR'}}}
]};
const result = read('PlannerBuilder.create(template,configuration)');
assert.equal(result.state.setup.rig,'Ranger 9000');
assert.equal(result.state.setup.start,'2026-10-02T06:00');
assert.equal(result.state.wells.length,2);assert.equal(result.state.phases.length,12);
assert(result.state.phases.every(phase=>phase.mode==='duration'&&phase.rows.length>0));
assert(result.state.wells.every(well=>well.standardCadence));
assert.equal(result.state.wells[1].setup.formation,'WCC');
assert.equal(result.state.wells[1].setup.pre,4);assert.equal(result.state.wells[1].setup.post,6);
assert.equal(result.state.wells[1].setup.prod,24);
assert.equal(result.state.setup.pre,8);
assert.equal(result.state.phases[3].name,'TOH');
assert.equal(result.state.phases[4].productionMethod,'HPGL');
assert.equal(result.state.phases[10].productionMethod,'ESP & ESP-HR');
assert.equal(result.state.phases[2].rows.length,3);
assert.equal(result.state.phases[2].rows[0].code,'WOV_DOP');
assert.equal(result.state.phases[2].rows[0].duration,27.93988235);
assert.equal(result.state.phases[2].rows[0].planningPlaceholder,'drill-out');
// Workbook defaults are unconditional. Alternatives are mutually exclusive and
// every well uses its own phase choices, including all combinations of Yes/No.
for (const motorBha of [false,true]) for (const snub of [false,true]) for (const killMethod of ['10 KWF','Top Kill']) {
  context.ingredientsWell={...context.configuration.wells[0],phaseSelections:{preOps:{firstWell:true,motorBha},toh:{snub,killMethod},setProduction:{method:'HPGL'}}};
  const plans=read('PlannerBuilder.phasePlans(template.seed,ingredientsWell)');
  const ingredientRows=phase=>Array.from(phase.rows,row=>row.ingredientRow);
  assert.deepEqual(ingredientRows(plans[0]),[4,5,6,8,9,10,11,motorBha?15:14]);
  assert.deepEqual(ingredientRows(plans[1]),[17,18,19,20,21]);
  assert.deepEqual(ingredientRows(plans[2]),[24,27,28]);
  assert.deepEqual(ingredientRows(plans[3]),snub?[32,33,34,35]:[killMethod==='10 KWF'?30:31]);
  for (const phase of plans) {
    assert(Math.abs(phase.rows.reduce((sum,row)=>sum+row.duration,0)-phase.target)<1e-7,'Selected rows share the existing phase target');
    assert(phase.rows.every(row=>row.duration>=0&&row.target===row.duration));
  }
  if(snub) for(const [index,weight] of [12,0.25,1.25,3].entries()) assert(Math.abs(plans[3].rows[index].duration-plans[3].target*weight/16.5)<1e-7,'Snubbing uses the supplied 12 : .25 : 1.25 : 3 weights');
  const bha=plans[0].rows.at(-1);
  assert(bha.com.includes(motorBha?'function test BHA':'Measured & MU BHA'));
  assert.equal(plans[1].rows.filter(row=>row.code==='TEST_SL/FLT').length,1,'TIH default includes the Washington/float test');
  assert(!plans[2].rows[1].com.includes('Aphron'));
  assert.equal(plans[2].rows.at(-1).com,'Crew conducted PTB to POOH w/ WS.');
}
for (const [firstWell,splitString,motorBha] of [[true,false,false],[false,false,false],[true,true,false],[false,false,true],[true,true,true]]) {
  context.combo={...context.configuration.wells[0],phaseSelections:{preOps:{firstWell,splitString,motorBha},setProduction:{method:'CGL'}}};
  const plans=read('PlannerBuilder.phasePlans(template.seed,combo)');
  const expected=(firstWell?8:4);
  assert(Math.abs(plans[0].rows.reduce((sum,row)=>sum+row.duration,0)-expected)<1e-7);
  context.noAdditions={...context.combo,phaseSelections:{preOps:{firstWell},setProduction:{method:'CGL'}}};
  const base=read('PlannerBuilder.phasePlans(template.seed,noAdditions)[0].rows');
  for(const code of ['TEST_BOP','WOV_BHA']) {
    const difference=plans[0].rows.find(row=>row.code===code).duration-base.find(row=>row.code===code).duration;
    assert(Math.abs(difference)<1e-7);
  }
}
assert.equal(new Set([result.state.docId,...result.state.wells.map(well=>well.id),...result.state.phases.map(phase=>phase.id)]).size,15);
assert.notEqual(result.state.docId,read('PlannerBuilder.create(template,configuration).state.docId'),'Generated jobs have independent recovery identities');
assert(!/<script[^>]+src=/.test(result.html),'Created planner retains its offline importer');
assert.equal(result.filename,'Time Planner - Ranger 9000.html');
assert.equal(result.state.preOpsRecovery,undefined);assert.equal(result.state.importDetails,undefined);
assert(result.html.includes('<title>Ranger 9000; 2 wells · Time Planner</title>'));

// Execute the actual generated planner, so its timing, targets, setup and saving
// schema are checked against the same application the user downloads.
const nodes=new Map();
function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,scrollLeft:0,addEventListener(){},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=result.html.match(/id="planner-data">([\s\S]*?)<\/script>/)[1];
const cols=Array.from({length:12},element);
const plannerContext={document:{addEventListener(){},getElementById:get,querySelector:get,querySelectorAll:selector=>selector==='#log col'?cols:[],createElement:element},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
vm.createContext(plannerContext);vm.runInContext(result.html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],plannerContext);
const plannerRead=expression=>vm.runInContext(expression,plannerContext);
assert.equal(get('jobTitle').textContent,'Ranger 9000; 2 wells');
assert.equal(plannerRead('targets().values[2]'),28.68988235);
assert.equal(plannerRead('targets().values[8]'),17.28);
assert.equal(plannerRead('targets().values[1]'),7);
assert.equal(plannerRead('targets().values[3]'),9.3);
assert.equal(plannerRead('wellSwapTime(state.wells[0],derive())'),plannerRead('derive()[2].at(-1).computedEnd'));
assert(plannerRead('derive().flat().every(row=>!row.error&&valid(row.computedDuration))'));
assert.equal(plannerRead('performance(derive().flat()).attainment'),100);
assert.equal(plannerRead('applyPreOpsRecovery()'),0);
for(let index=0;index<2;index++){
  const setup=result.state.wells[index].setup;
  context.setup=setup;
  assert.deepEqual(Array.from(read('PlannerBuilder.phaseTargets(template.seed,setup)')),Array.from(plannerRead('targets().values.slice('+index*6+','+(index+1)*6+')')));
}
// Applying the generated planner's setup retains its selected phase rules.
get('setupBtn').onclick();
const setupValues=plannerRead("new Map([['wellCount',String(state.wells.length)],['rig',state.setup.rig],['start',state.setup.start],...state.wells.flatMap((well,index)=>setupFields.filter(([key])=>!['rig','start'].includes(key)).map(([key])=>[fieldName(index,key),String(key==='title'?well.title:wellSetup(well)[key])]))])");
plannerContext.FormData=class{constructor(values){this.values=values}get(key){return this.values.get(key)}};
get('setupForm').onsubmit({preventDefault(){},target:setupValues});
assert.deepEqual(JSON.parse(plannerRead('JSON.stringify(state.wells[0].setup.phaseSelections)')),JSON.parse(JSON.stringify(result.state.wells[0].setup.phaseSelections)));
assert.equal(plannerRead('targets().values[1]'),7);
assert.equal(plannerRead('targets().values[3]'),9.3);
plannerRead('state.phases.forEach(p=>p.rows=[{...newRow(),duration:1}]);render()');
assert.equal(plannerRead('wellSwapTime(state.wells[0],derive())'),Date.UTC(2026,9,2,9));
assert.equal(plannerRead('wellSwapTime(state.wells[1],derive())'),Date.UTC(2026,9,2,15));
plannerRead('state=JSON.parse(JSON.stringify(state));render()');
assert.equal(plannerRead('state.wells[1].setup.pre'),4);

// Empty/invalid loaders retain planning. A real import replaces only the
// Drill Out placeholder, keeps manual work, allocates its budget and shifts dates.
plannerContext.generatedState=structuredClone(result.state);
plannerRead('state=structuredClone(generatedState);history=[];render();active=2;applyRowTool("duplicate",0)');
assert.equal(plannerRead('state.phases[2].rows[1].planningPlaceholder'),undefined,'A duplicate is manual work');
get('undoBtn').onclick();
plannerRead("state.phases[2].rows.push({...newRow(),duration:0.25,category:'WORKOVER',desc:'DRILL OUT PLUG',code:'WOV_DOP',com:'Keep this manual note'});setAllTimeModes('date')");
const beforeImport=JSON.parse(plannerRead('JSON.stringify(state.phases)'));
const start=plannerRead('derive()[2][0].start');
plannerContext.workbook={name:'First well loader.xlsm',sourceWell:'First well'};
plannerContext.emptyPreview={rows:[],errors:[],notes:[]};
assert.equal(plannerRead('planLoaderImport(state.phases[2],workbook,emptyPreview).replaced'),0);
assert.equal(plannerRead('state.phases[2].rows[0].planningPlaceholder'),'drill-out');
plannerContext.preview={errors:[],notes:[],rows:[
  {sourceRow:9,start,end:start+2*3600000,previewStart:start,previewEnd:start+2*3600000,duration:2,category:'WORKOVER',desc:'DRILL OUT PLUG',code:'WOV_DOP',com:'Imported activity 1'},
  {sourceRow:10,start:start+2*3600000,end:start+5*3600000,previewStart:start+2*3600000,previewEnd:start+5*3600000,duration:3,category:'WORKOVER',desc:'DRILL OUT PLUG',code:'WOV_DOP',com:'Imported activity 2'}
]};
plannerContext.invalidPreview={...plannerContext.preview,errors:['Invalid timing']};
assert.throws(()=>plannerRead('applyLoaderImport(state.phases[2].id,workbook,invalidPreview)'),/Correct the loader/);
assert.deepEqual(JSON.parse(plannerRead('JSON.stringify(state.phases)')),beforeImport);
assert.equal(plannerRead('planLoaderImport(state.phases[2],workbook,preview).replaced'),1);
const importPlan=plannerRead('applyLoaderImport(state.phases[2].id,workbook,preview)');
assert.equal(importPlan.replaced,1);assert.equal(importPlan.added,2);
assert.equal(plannerRead('state.phases[2].rows.length'),5);
assert(plannerRead("state.phases[2].rows.some(row=>row.com==='Keep this manual note')"));
assert(!plannerRead('state.phases[2].rows.some(row=>row.planningPlaceholder)'));
assert.equal(plannerRead('wellSwapTime(state.wells[0],derive())'),start+6*3600000);
assert.deepEqual(JSON.parse(plannerRead('JSON.stringify(state.phases[2].rows.filter(row=>row.builderActivity===\"drill-out-follow-up\").map(row=>row.ingredientRow))')),[27,28]);
assert(plannerRead('derive()[2].filter(row=>row.builderActivity===\"drill-out-follow-up\").every(row=>row.start>=derive()[2].filter(row=>row.loaderSource).at(-1).computedEnd)'),'Loader activities finish before the default circulation and PTB');
assert(Math.abs(plannerRead('phasePerformance(state.phases[2],derive()[2]).target')-28.68988235)<1e-7);
assert(plannerRead('derive().flat().every(row=>!row.error)'));
assert.equal(plannerRead('applyLoaderImport(state.phases[2].id,workbook,preview).added'),0);
// Imports longer than the original forecast still keep circulation/PTB last.
plannerContext.longPreview={...plannerContext.preview,rows:plannerContext.preview.rows.map((row,index)=>index===1?{...row,end:start+50*3600000,previewEnd:start+50*3600000,duration:48}:row)};
plannerRead('applyLoaderImport(state.phases[2].id,workbook,longPreview)');
assert.deepEqual(JSON.parse(plannerRead('JSON.stringify(state.phases[2].rows.slice(-2).map(row=>row.ingredientRow))')),[27,28]);
assert(plannerRead('derive()[2].slice(-2).every(row=>row.start>=derive()[2].filter(row=>row.loaderSource).at(-1).computedEnd)'));
assert(plannerRead('derive().flat().every(row=>!row.error)'));
get('undoBtn').onclick();
get('undoBtn').onclick();
assert.deepEqual(JSON.parse(plannerRead('JSON.stringify(state.phases)')),beforeImport,'Undo restores the forecast row and all shifted end dates');

context.hostile={...context.configuration,rig:'',wells:[{...context.configuration.wells[0],title:'Álpha </script><img src=x onerror=alert(1)> & $&'}]};
const escaped=read('PlannerBuilder.create(template,hostile)');
assert(!escaped.html.includes('<img src=x'),'Well names cannot inject HTML');
assert.equal(JSON.parse(escaped.html.match(/id="planner-data">([\s\S]*?)<\/script>/)[1]).title,context.hostile.wells[0].title);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,start:'2026-02-30T06:00'})"),/valid job start/);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,wells:[{...configuration.wells[0],plugs:2.5}]})"),/whole plug count/);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,wells:[{...configuration.wells[0],lateral:0}]})"),/positive lateral/);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,wells:[{...configuration.wells[0],formation:'Unknown'}]})"),/choose a formation/);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,wells:[{...configuration.wells[0],phaseSelections:{setProduction:{method:'Unknown'}}}]})"),/Set Production method/);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,wells:[{...configuration.wells[0],phaseSelections:{toh:{killMethod:'Unknown'},setProduction:{method:'HPGL'}}}]})"),/TOH kill method/);
assert.throws(()=>read("PlannerBuilder.create(template,{...configuration,wells:[{...configuration.wells[0],phaseSelections:{preOps:{motorBha:'yes'},setProduction:{method:'HPGL'}}}]})"),/Yes or No/);
console.log('PASS: populated phase builder, selection-specific hours/rows, independent wells, matching targets, TOH naming, production choices, placeholder replacement/manual preservation, end-time rescheduling/Undo, offline application, validation and escaped names.');

for(const [index,vendor] of [[0,'HPGL'],[1,'ESP']]){
 const rows=result.state.phases.filter(p=>p.wellId===result.state.wells[index].id).flatMap(p=>p.rows);
 assert(rows.some(r=>r.code==='WOV_POOH'));
 for(const row of rows)assert.equal(row.logistics.startsWith('Dispatch '+vendor+' vendors:'),row.code==='WOV_POOH');
}

// Retired flags in an older configuration cannot add activities or allowances.
const retired = read('PlannerBuilder.create(template,configuration)');
assert(!JSON.stringify(retired.state.wells).includes('splitString'));
assert(!JSON.stringify(retired.state.wells).includes('aphron'));
assert(retired.state.phases.every(p=>p.rows.every(r=>r.builderActivity!=='split-string'&&!r.com.includes('Aphron'))));

// Removing a template line preserves the phase budget and scales every survivor proportionally.
read(`var reducedSeed=structuredClone(template.seed);
var baselinePlan=PlannerBuilder.phasePlans(template.seed,configuration.wells[0])[1];
reducedSeed.activityTemplates['Trip in Hole']=reducedSeed.activityTemplates['Trip in Hole'].filter(row=>row.ingredientRow!==19);
var reducedPlan=PlannerBuilder.phasePlans(reducedSeed,configuration.wells[0])[1];`);
const baselinePlan=read('baselinePlan'),reducedPlan=read('reducedPlan');
assert.equal(reducedPlan.target,baselinePlan.target);
const remainingTotal=baselinePlan.rows.filter(r=>r.ingredientRow!==19).reduce((sum,r)=>sum+r.duration,0);
for(const row of reducedPlan.rows){
 const previous=baselinePlan.rows.find(r=>r.ingredientRow===row.ingredientRow);
 assert(Math.abs(row.duration-previous.duration/remainingTotal*baselinePlan.target)<1e-7);
}
assert(Math.abs(reducedPlan.rows.reduce((sum,r)=>sum+r.duration,0)-baselinePlan.target)<1e-7);

for(const well of result.state.wells){
 const rows=result.state.phases.filter(p=>p.wellId===well.id).flatMap(p=>p.rows);
 assert(rows.some(r=>r.code==='TEST_BOP'));
 for(const row of rows){
  plannerContext.cueRow=row;plannerContext.firstInJob=row===result.state.phases[0].rows[0];
  assert.equal(row.sshe,plannerRead('verificationCue(cueRow,firstInJob)'));
 }
}

// Repeat imports repair misplaced closing rows, including older ingredient rows
// without the explicit builder marker. Preserve edited details in both input modes.
for (const mode of ['duration','date']) {
 plannerRead('state=structuredClone(generatedState);history=[];render()');
 plannerRead("state.phases[2].rows.slice(-2).forEach(row=>{delete row.builderActivity;row.logistics='Keep logistics';row.sshe='Keep verification';row.com+=' Edited';});setAllTimeModes('"+mode+"')");
 const closing=JSON.parse(plannerRead('JSON.stringify(state.phases[2].rows.slice(-2))'));
 plannerRead('applyLoaderImport(state.phases[2].id,workbook,longPreview)');
 for (const [i,row] of closing.entries()) {
  const actual=plannerRead('state.phases[2].rows.at('+(-2+i)+')');
  for (const key of ['id','code','com','logistics','sshe']) assert.equal(actual[key],row[key]);
 }
 assert(plannerRead('derive().flat().every(row=>!row.error)'));
 const durations=Array.from(plannerRead('derive()[2].slice(-2).map(row=>row.computedDuration)'));
 assert.deepEqual(durations,[0.5,0.25]);
 plannerRead('state.phases[2].rows.unshift(...state.phases[2].rows.splice(-2))');
 assert.equal(plannerRead('planLoaderImport(state.phases[2],workbook,longPreview).reordered'),true);
 plannerRead('applyLoaderImport(state.phases[2].id,workbook,longPreview)');
 assert.deepEqual(Array.from(plannerRead('state.phases[2].rows.slice(-2).map(row=>row.code)')),['WOV_CIRC','SAFETY']);
 assert.equal(plannerRead('state.phases[2].rows.length'),4);
 assert.equal(plannerRead('planLoaderImport(state.phases[2],workbook,longPreview).overlaps'),0);
}

assert.equal(result.state.phases.flatMap(p=>p.rows).filter(r=>r.sshe.includes('Well Handover:')).length,1);
assert(result.state.phases[0].rows[0].sshe.includes('Muster signs & PSMS signage'));

// Planner setup exposes and saves the same independent well variables as Builder.
plannerRead('state=structuredClone(generatedState);history=[];render()');
get('setupBtn').onclick();
for(const label of ['Production Equipment','WL for Packer or ESP Catch?','1st Well?','Motor BHA?','Snub?','Kill method','4.0 hrs for well swap; 8.0 hrs for last well on pad'])assert(get('setupFields').innerHTML.includes(label));
const variableForm=plannerRead("new Map([['wellCount',String(state.wells.length)],['rig',state.setup.rig],['start',state.setup.start],...state.wells.flatMap((well,index)=>setupFields.filter(([key])=>!['rig','start'].includes(key)).map(([key])=>[fieldName(index,key),String(key==='title'?well.title:wellSetup(well)[key])]))])");
for(const [key,value] of Object.entries({production:'CGL',wlPackerEspCatch:'yes',preFirst:'no',motorBha:'yes',tohSnub:'yes',tohKill:'Top Kill',well1_production:'GAPL',well1_wlPackerEspCatch:'no',well1_preFirst:'yes',well1_motorBha:'no',well1_tohSnub:'no',well1_tohKill:'10 KWF'}))variableForm.set(key,value);
const beforeSetupDurations=JSON.parse(plannerRead('JSON.stringify(derive().flat().map(row=>row.computedDuration))'));
get('setupForm').onsubmit({preventDefault(){},target:variableForm});
assert.equal(plannerRead('state.setup.pre'),4);
assert.equal(plannerRead('state.wells[1].setup.pre'),8);
assert.equal(plannerRead('state.setup.phaseSelections.preOps.motorBha'),true);
assert.equal(plannerRead('state.setup.phaseSelections.toh.snub'),true);
assert.equal(plannerRead('state.setup.phaseSelections.toh.killMethod'),'Top Kill');
assert.equal(plannerRead('state.setup.phaseSelections.setProduction.wlPackerEspCatch'),true);
assert.equal(plannerRead('state.phases[4].productionMethod'),'CGL');
assert.equal(plannerRead('state.phases[10].productionMethod'),'GAPL');
assert.deepEqual(JSON.parse(plannerRead('JSON.stringify(derive().flat().map(row=>row.computedDuration))')),beforeSetupDurations);
plannerRead('state=JSON.parse(JSON.stringify(state))');get('setupBtn').onclick();
assert(get('setupFields').innerHTML.includes('name="production"'));
assert.equal(plannerRead('setupVariables(setupWorkingWells[0].setup).tohKill'),'Top Kill');
get('undoBtn').onclick();assert.equal(plannerRead('state.setup.phaseSelections.toh.snub'),false);
