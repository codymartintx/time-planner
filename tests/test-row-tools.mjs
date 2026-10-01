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
assert.equal(read('Math.round(performance(derive().flat()).target*1e8)/1e8'),98.51753846);
// Tooltips show on hover/focus, stay inside the viewport, and preserve existing descriptions.
context.window.innerWidth=360;context.window.innerHeight=180;
document.body=element();let host='';document.body.appendChild=()=>{host='body'};
const tip=get('controlTooltip');tip.offsetWidth=260;tip.offsetHeight=70;
const attrs={'aria-describedby':'existing-help'};
const owner={dataset:{tooltip:'Insert a row below this row.'},getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=v},removeAttribute:k=>{delete attrs[k]},closest:s=>null,contains:t=>t===owner,getBoundingClientRect:()=>({left:340,top:130,bottom:150})};
tooltipEvents.pointerover[0]({target:{closest:()=>owner}});
assert.equal(tip.hidden,false);assert.equal(tip.textContent,owner.dataset.tooltip);assert.equal(tip.style.left,'92px');assert.equal(tip.style.top,'52px');assert.equal(host,'body');assert.equal(attrs['aria-describedby'],'existing-help controlTooltip');
tooltipEvents.keydown[0]({key:'Escape'});assert.equal(tip.hidden,true);assert.equal(attrs['aria-describedby'],'existing-help');
const dialog=element();dialog.appendChild=()=>{host='dialog'};owner.closest=()=>dialog;
tooltipEvents.focusin[0]({target:{closest:()=>owner}});assert.equal(host,'dialog');assert.equal(tip.hidden,false);
read('render()');assert.equal(tip.hidden,true);assert.equal(attrs['aria-describedby'],'existing-help');
assert(get('rows').innerHTML.includes('data-action="duplicate"'));assert(get('rows').innerHTML.includes('data-action="up"'));assert(get('rows').innerHTML.includes('data-action="down"'));assert(get('rows').innerHTML.includes('aria-label="Delete row'));
console.log('PASS: moves stay within phases; date/duration duplicates and deletes preserve other activity durations and shift the schedule; Undo restores rows/times; copied reminders, reviewed targets, and WellView export; hover/focus tooltips, viewport bounds, dialog visibility and Escape.');
