import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=html.match(/<script type="application\/json" id="planner-data">([\s\S]*?)<\/script>/)[1];
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const nodes=new Map();
function element(){return {textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,scrollLeft:0,addEventListener(){},setAttribute(){},removeAttribute(){},appendChild(){},showModal(){this.open=true},close(){this.open=false}}}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
get('planner-data').textContent=data;
const cols=Array.from({length:12},element),storage=new Map();
const context={document:{addEventListener(){},getElementById:get,querySelector:get,querySelectorAll:s=>s==='#log col'?cols:[],createElement:element},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},structuredClone,console,setTimeout:()=>0,clearTimeout(){},Date,confirm:()=>true};
vm.createContext(context);vm.runInContext(script,context);
const read=expression=>vm.runInContext(expression,context),json=expression=>JSON.parse(read('JSON.stringify('+expression+')'));
const before=json('state'),phaseId=read('state.phases[2].id');
const beforeTimes=json('derive()');
assert.equal((get('rows').innerHTML.match(/data-action="import-loader"/g)||[]).length,1);
assert(html.includes('<script data-library="jszip">'));
assert(!/<script[^>]+src=/.test(html),'Importer remains offline and self-contained');

const header={number:6,cells:Object.fromEntries(Object.entries({B:'Start Time',C:'1/10 Hour',D:'End Time',E:'1/10 Hour',F:'Duration',G:'Mjr Ops Code',H:'Description',I:'Operation',J:'Com '}).map(([k,value])=>[k,{value}]))};
function workbook(activities,name='Test Loader.xlsm'){
 return {name,sourceWell:'Test well',date1904:false,rows:[header,...activities.map((values,i)=>({number:i+9,cells:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}))]};
}
function preview(source,date='2026-09-29'){
 context.source=source;context.firstDate=date;return json('buildLoaderPreview(source,firstDate)');
}
const op={G:'WORKOVER',H:'DRILL OUT PLUG',I:'WOV_DOP'};
const blank=preview(workbook([op,{...op,B:null,D:null,F:null,J:''}]));
assert.equal(blank.rows.length,0);assert.equal(blank.skipped,2);
assert.deepEqual(json('state'),before);
assert.throws(()=>preview({rows:[],name:'Wrong headers.xlsx'}),/headers/);

// Clock-only loader times span multiple midnights; saved rounded duration is secondary.
const source=workbook([
 {...op,B:'23:49',D:'6:00',F:6.183,J:'First plug\n4.0 BPM & <notes> "quoted"'},
 {...op,B:6/24,D:(10*60+40)/1440,F:4.667,J:'Next plugs'},
 {...op,B:'10:40',D:'20:30',J:'Long interval'},
 {...op,B:'20:30',D:'03:15',F:6.750,J:'Second overnight interval'},
 {...op,B:'03:15',D:'06:00',J:'Last plugs'},
 op
]);
const parsed=preview(source);
assert.equal(parsed.rows.length,5);assert.equal(parsed.skipped,1);assert.equal(parsed.errors.length,0);assert.equal(parsed.notes.length,0);
assert.equal(parsed.rows[0].start,Date.UTC(2026,8,29,23,49));
assert.equal(parsed.rows[0].end,Date.UTC(2026,8,30,6));
assert.equal(parsed.rows[1].end,Date.UTC(2026,8,30,10,40));
assert.equal(parsed.rows[3].end,Date.UTC(2026,9,1,3,15));
assert.equal(parsed.rows[0].duration,Math.round(371/60*1e8)/1e8);
assert.equal(parsed.rows[0].com,source.rows[1].cells.J.value);
assert.equal(preview(source,'').errors.length,5);

// Excel calendar systems, zero, AM/PM, invalid dates and partial rows.
assert.equal(read('loaderTime(1,true).ms'),Date.UTC(1904,0,2));
assert.equal(read('loaderTime(59).ms'),Date.UTC(1900,1,28));
assert.equal(read('loaderTime(61).ms'),Date.UTC(1900,2,1));
assert.equal(read("loaderTime('12:00 AM').clock"),0);
assert.equal(read("loaderTime('12:00 PM').clock"),43200000);
assert.throws(()=>read("loaderTime('2026-02-30T12:00')"),/invalid calendar/);
assert.throws(()=>read("loaderTime('25:00')"),/invalid clock/);
const mixed=preview(workbook([{...op,B:'09/29/2026 23:49',D:'09/30/2026 06:00',F:99,J:'Use times'},{...op,B:'2026-09-30T06:00',F:0,J:'Zero-hour activity'},{...op,J:'Incomplete note'}]));
assert.equal(mixed.notes.length,1);assert.equal(mixed.rows[1].duration,0);assert.equal(mixed.rows[1].end,mixed.rows[1].start);assert.equal(mixed.rows[2].duration,null);
const invalid=preview(workbook([{...op,B:'2026-10-01T06:00',D:'2026-09-30T06:00',J:'Invalid date order'}]));
assert.equal(invalid.errors.length,1);

// Preview is read-only. Only Drill Out receives loader data; later phases keep
// their activity durations while their end-time inputs follow the new finish.
context.loaderWorkbook=source;context.loaderPreview=parsed;context.phaseId=phaseId;
read('planLoaderImport(state.phases[2],loaderWorkbook,loaderPreview)');
assert.deepEqual(json('state'),before);
assert.throws(()=>read('planLoaderImport(state.phases[0],loaderWorkbook,loaderPreview)'),/only for Drill Out/);
const plan=json('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)');
assert.equal(plan.added,5);assert.equal(plan.updated,0);
for(let i=0;i<2;i++)assert.deepEqual(json('state.phases['+i+']'),before.phases[i]);
for(let i=3;i<6;i++){
 const phase=json('state.phases['+i+']'),times=json('derive()['+i+']');
 assert.deepEqual({...phase,rows:phase.rows.map(r=>({...r,end:null}))},{...before.phases[i],rows:before.phases[i].rows.map(r=>({...r,end:null}))});
 for(let j=0;j<times.length;j++){assert.equal(times[j].computedDuration,beforeTimes[i][j].computedDuration,'Later phase duration survives the import');assert.equal(times[j].error,'');}
}
assert.equal(read('derive()[3][0].start'),parsed.rows.at(-1).end);
assert.equal(read('wellSwapTime(state.wells[0],derive())'),parsed.rows.at(-1).end,'Swap follows the imported Drill Out finish');
const initialManual=before.phases[2].rows;
for(const row of initialManual)assert.deepEqual(json('state.phases[2].rows.find(r=>r.id===\''+row.id+'\')'),row);
const imported=json('state.phases[2].rows.filter(r=>r.loaderSource)');
assert.equal(imported.length,5);assert.equal(imported[0].loaderSource.row,9);
assert.equal(imported[0].loaderStart,'2026-09-29T23:49:00.000');
const computed=json('derive()[2].filter(r=>r.loaderSource)');
for(let i=0;i<5;i++){assert.equal(computed[i].start,parsed.rows[i].start);assert.equal(computed[i].computedEnd,parsed.rows[i].end)}
assert(get('rows').innerHTML.includes('data-field="loaderStart"'));
assert(get('rows').innerHTML.includes('&lt;notes&gt;'));
assert(JSON.parse([...storage.values()][0]).phases[2].rows.some(r=>r.loaderSource));
const afterImport=json('state');
const again=json('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)');
assert.equal(again.added,0);assert.equal(again.updated,0);assert.equal(again.unchanged,5);assert.deepEqual(json('state'),afterImport);

// A later or earlier finish on reimport shifts end-time phases by the same
// amount without stretching their activities; Undo restores all shifted dates.
for(const [finish,delta]of [['07:00',3600000],['05:00',-3600000]]){
 const changedTiming=structuredClone(source);changedTiming.rows[5].cells.D.value=finish;
 context.loaderWorkbook=changedTiming;context.loaderPreview=preview(changedTiming);
 const rescheduled=json('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)');
 assert.equal(rescheduled.added,0);assert.equal(rescheduled.updated,1);
 assert.equal(read('derive()[3][0].start'),parsed.rows.at(-1).end+delta);
 assert.equal(read('wellSwapTime(state.wells[0],derive())'),parsed.rows.at(-1).end+delta);
 for(let i=3;i<6;i++)for(let j=0;j<beforeTimes[i].length;j++){
  const row=json('derive()['+i+']['+j+']');assert.equal(row.computedDuration,beforeTimes[i][j].computedDuration);assert.equal(row.error,'');
 }
 get('undoBtn').onclick();assert.deepEqual(json('state.phases'),afterImport.phases);
 assert.equal(read('wellSwapTime(state.wells[0],derive())'),parsed.rows.at(-1).end,'Undo restores the swap time');
}

// Updated saves keep imported IDs and manually written reminder fields.
read("state.phases[2].rows.find(r=>r.loaderSource).logistics='Keep crew note';state.phases[2].rows.find(r=>r.loaderSource).sshe='Keep safety note'");
const revised=structuredClone(source);revised.name='Test Loader - later save.xlsm';revised.rows[1].cells.J.value='Revised loader comment';
context.loaderWorkbook=revised;context.loaderPreview=preview(revised);
const updated=json('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)');
assert.equal(updated.added,0);assert.equal(updated.updated,5);
const first=json('state.phases[2].rows.find(r=>r.loaderSource)');
assert.equal(first.id,imported[0].id);assert.equal(first.com,'Revised loader comment');assert.equal(first.logistics,'Keep crew note');assert.equal(first.sshe,'Keep safety note');
for(const row of initialManual)assert.deepEqual(json('state.phases[2].rows.find(r=>r.id===\''+row.id+'\')'),row);

// Blank/manual entries retain normal editing and copying; duplicate is a manual activity.
read('active=2;insert(state.phases[2].rows.length)');
const manualId=read('state.phases[2].rows.at(-1).id');
get('rows').onchange({target:{dataset:{field:'duration'},value:'0.5',closest:()=>({dataset:{phaseIndex:'2',id:manualId}})}});
assert.equal(read('state.phases[2].rows.at(-1).duration'),0.5);
assert.equal(read('state.phases[2].rows.at(-1).loaderSource'),undefined);
read('setAllTimeModes("duration");active=2;applyRowTool("duplicate",state.phases[2].rows.findIndex(r=>r.loaderSource))');
const copy=json('state.phases[2].rows.find((r,i,rows)=>i>0&&rows[i-1].loaderSource&&!r.loaderSource&&r.com===rows[i-1].com)');
assert.equal(copy.loaderStart,undefined);assert.equal(copy.loaderSource,undefined);assert.equal(copy.duration,imported[0].duration);
get('undoBtn').onclick();
read('setAllTimeModes("date")');
const dates=json('derive()[2].filter(r=>r.loaderSource)');
for(let i=0;i<5;i++){assert.equal(dates[i].start,parsed.rows[i].start);assert.equal(dates[i].computedEnd,parsed.rows[i].end)}

// Invalid imports are atomic; Undo restores the complete pre-import phase.
const beforeInvalid=json('state');context.loaderPreview=invalid;
assert.throws(()=>read('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)'),/Correct the loader/);
assert.deepEqual(json('state'),beforeInvalid);
context.original=before;read('state=structuredClone(original);history=[]');
context.loaderWorkbook=source;context.loaderPreview=parsed;
read('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)');get('undoBtn').onclick();
assert.deepEqual(json('state.phases'),before.phases);

// Exact manual duplicates are not added or overwritten by the loader.
read("state.phases[2].rows=[{...newRow(),loaderStart:'2026-09-29T23:49:00.000',end:'2026-09-30T06:00:00.000',duration:371/60,category:'WORKOVER',desc:'DRILL OUT PLUG',code:'WOV_DOP',com:'First plug\\n4.0 BPM & <notes> \"quoted\"',logistics:'Manual note'}];state.phases[2].mode='duration'");
const duplicates=json('applyLoaderImport(phaseId,loaderWorkbook,loaderPreview)');
assert.equal(duplicates.duplicates,1);assert.equal(duplicates.added,4);assert.equal(read('state.phases[2].rows[0].logistics'),'Manual note');
console.log('PASS: Drill Out-only loader data, template skipping, overnight dates, Excel calendars, exact timestamps/comments, duration fallback, preview isolation, reimport updates, downstream end-time rescheduling with preserved durations, manual rows/reminders, duplicate detection, atomic errors, mode switching and Undo.');
