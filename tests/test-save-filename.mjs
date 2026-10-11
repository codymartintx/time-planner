import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const nodes=new Map();
function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,scrollLeft:0,addEventListener(){},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=html.match(/id="planner-data">([\s\S]*?)<\/script>/)[1];
const fixed=new Date(2026,9,3,14,35,12);
class TestDate extends Date{constructor(...args){super(...(args.length?args:[fixed.getTime()]))}static now(){return fixed.getTime()}}
const cols=Array.from({length:12},element);
let savedData,closedDialog=false;
const clone={querySelector(){return savedData={textContent:''}},querySelectorAll(){return [{removeAttribute(name){assert.equal(name,'open');closedDialog=true}}]},get outerHTML(){return '<html><script type="application/json" id="planner-data">'+savedData.textContent+'</script></html>'}};
const context={document:{documentElement:{cloneNode(){return clone}},addEventListener(){},getElementById:get,querySelector:get,querySelectorAll:s=>s==='#log col'?cols:[],createElement:element},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date:TestDate,confirm:()=>true};
vm.createContext(context);vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],context);
const read=expression=>vm.runInContext(expression,context);
context.fixed=fixed;
assert.equal(read('plannerFilename(fixed)'),'timePlanner_Midland Basin 1H_2026-10-03_14-35-12.html');
context.unsafeName='  Alpha / B:4? "North"  ';
read('state.title=unsafeName;normalizeWells()');
assert.equal(read('plannerFilename(fixed)'),'timePlanner_Alpha - B-4- -North-_2026-10-03_14-35-12.html');
read("state.title='First Well';normalizeWells();state.wells.push({...blankWell(),title:'Second Well'})");
assert.equal(read('plannerFilename(fixed)'),'timePlanner_First Well + Second Well_2026-10-03_14-35-12.html');
read("state.wells.length=1;state.title='';normalizeWells()");
assert.equal(read('plannerFilename(fixed)'),'timePlanner_Untitled well_2026-10-03_14-35-12.html');
read("state.title='Save Test <well>';normalizeWells();state.phases[0].rows[0].com='Keep my saved comment';download=(content,type,name)=>{globalThis.savedDownload={content,type,name}}");
get('saveBtn').onclick();
assert.equal(context.savedDownload.name,'timePlanner_Save Test -well-_2026-10-03_14-35-12.html');
assert.equal(context.savedDownload.type,'text/html;charset=utf-8');
const restored=JSON.parse(savedData.textContent);
assert.equal(restored.title,'Save Test <well>');
assert.equal(restored.phases[0].rows[0].com,'Keep my saved comment');
assert.equal(restored.updated,fixed.getTime());
assert.equal(closedDialog,true);assert.equal(read('dirty'),false);
console.log('PASS: Save uses well names and local date/time, handles multiple/blank wells and unsafe filename characters, and retains serialized job edits.');
