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



assert(!html.includes('id="selectAll"'));assert(!html.includes('data-action="select"'));assert(!get('rows').innerHTML.includes('type="checkbox"'));
assert(html.includes('id="copySelectAll"'));assert(!html.includes('id="copyWindow"'));assert.equal(read('typeof splitReportingDays'),'undefined');
assert.equal(read('columnKeys.length'),12);assert.equal(read('state.columnWidths.length'),12);
const original=read('JSON.stringify(state.phases)');read('openWellView()');assert.equal(read('copyDays.length'),5);
const originalRows=JSON.parse(read('JSON.stringify(derive().flat())'));
let copiedIds=[];
for(let i=0;i<5;i++){
 get('copyDay').value=String(i);get('copyDay').onchange();
 const group=JSON.parse(read('JSON.stringify(copyDays[Number($("copyDay").value)])'));
 for(const row of group.rows){
  const source=originalRows.find(r=>r.id===row.id);
  assert.equal(row.start,source.start);assert.equal(row.computedEnd,source.computedEnd);assert.equal(row.computedDuration,source.computedDuration);
  assert(row.start>=group.start&&row.start<group.end);copiedIds.push(row.id);
 }
 assert(get('copytext').value.split('\n').every(r=>r.split('\t').length===5));
 assert.equal(read('copyRows.length'),group.rows.length);assert(get('copySelectAll').checked);
}
assert.equal(new Set(copiedIds).size,originalRows.length);assert.equal(copiedIds.length,originalRows.length);assert.equal(read('JSON.stringify(state.phases)'),original);
// Long events retain their full times and durations, including across multiple reporting days.
read(`{const op=state.ops.find(o=>o.code==='NUND_BOP');state.setup.start='2026-09-22T23:00';state.phases=state.phases.map((p,i)=>({...p,mode:'duration',rows:i===0?[9,40,0,1].map((duration,j)=>({id:'whole-'+j,duration,target:1,end:null,category:op.category,desc:op.desc,code:op.code,com:'Entry '+j,logistics:'Reminder',sshe:'Review'})):[]}));render();openWellView()}`);
assert.equal(read('copyDays.length'),3);assert.equal(read('copyRows[0].computedDuration'),9);assert(get('copyPreviewRows').innerHTML.includes('kept whole'));
get('copyDay').value='1';get('copyDay').onchange();assert.equal(read('copyRows.length'),1);assert.equal(read('copyRows[0].computedDuration'),40);assert.equal(get('copytext').value.split('\t')[0],'40.00');
assert(read('copyRows[0].computedEnd>copyDays[1].end'));assert(get('copyPreviewRows').innerHTML.includes('kept whole'));
get('copyDay').value='2';get('copyDay').onchange();assert.equal(read('copyWindowRows.length'),2);assert.equal(read('copyRows.length'),2);
const before=read('JSON.stringify(state.phases)');
get('copyPreviewRows').onchange({target:{dataset:{copyId:'whole-3'},checked:false}});
assert.equal(read('copyRows.length'),1);assert.equal(read('copyRows[0].computedDuration'),0);assert(get('copySelectAll').indeterminate);assert(!get('clipboardBtn').disabled);assert(get('copytext').value.startsWith('0.00\t'));
get('copySelectAll').onchange({target:{checked:false}});assert.equal(read('copyRows.length'),0);assert.equal(get('copytext').value,'');assert(get('clipboardBtn').disabled);
get('copySelectAll').onchange({target:{checked:true}});assert.equal(read('copyRows.length'),2);assert(get('copySelectAll').checked);assert.equal(read('JSON.stringify(state.phases)'),before);
// Returning to a reporting day resets its preview selection to all entries.
get('copyPreviewRows').onchange({target:{dataset:{copyId:'whole-3'},checked:false}});get('copyDay').value='1';get('copyDay').onchange();get('copyDay').value='2';get('copyDay').onchange();assert.equal(read('copyRows.length'),2);
// An invalid selected operation blocks copy; deselecting it allows valid whole entries.
read("state.phases[0].rows[2].code='INVALID';openWellView()");get('copyDay').value='2';get('copyDay').onchange();assert(get('clipboardBtn').disabled);assert.equal(get('copytext').value,'');
get('copyPreviewRows').onchange({target:{dataset:{copyId:'whole-2'},checked:false}});assert(!get('clipboardBtn').disabled);assert.equal(get('copytext').value.split('\t')[0],'1.00');
// Incomplete future work does not block completed entries in another day.
read("state.phases[5].rows.push({...newRow(),id:'unfinished'});render();openWellView()");assert.equal(read('copyRows[0].computedDuration'),9);assert(!get('clipboardBtn').disabled);assert(get('copyValidation').textContent.includes('Unfinished'));
// Exactly 06:00 starts a new reporting day; a 05:30 entry crossing 06:00 stays in the previous day.
read(`{const op=state.ops.find(o=>o.code==='NUND_BOP');state.setup.start='2026-09-23T05:30';state.phases.forEach((p,i)=>p.rows=i===0?[.5,0,1].map((duration,j)=>({id:'boundary-'+j,duration,target:0,end:null,category:op.category,desc:op.desc,code:op.code,com:''})):[]);render();openWellView()}`);
assert.equal(read('copyDays.length'),2);assert.equal(read('copyDays[0].rows.length'),1);assert.equal(read('copyDays[1].rows.length'),2);
// Saved widths still migrate without changing retained fields.
read('state=structuredClone(seed);state.columnLayoutVersion=2;state.columnWidths=[24,44,100,140,141,92,93,125,201,113,346,250,251];render()');assert.deepEqual(Array.from(read('state.columnWidths')),[44,100,140,141,92,93,125,201,113,346,250,251]);
console.log('PASS: no main-screen selection or shift cutoffs; each whole event appears once by Start Time; original duration and times preserved across boundaries; preview selection/select-all/indeterminate states; five-column copy; selected operation validation; incomplete future work; saved-width migration.');
