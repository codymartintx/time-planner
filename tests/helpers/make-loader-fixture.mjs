// Minimal, independently authored Excel fixtures for the browser import smoke test.
import fs from 'node:fs';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';

const output=path.resolve(process.argv[2]||'outputs/loader-tests');fs.mkdirSync(output,{recursive:true});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const cell=(ref,value,type='n')=>type==='inlineStr'?`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`:`<c r="${ref}" t="${type}"><v>${escape(value)}</v></c>`;
function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^-1)>>>0}
function zip(files){
 const chunks=[],directory=[];let offset=0;
 for(const [name,text]of Object.entries(files)){
  const filename=Buffer.from(name),plain=Buffer.from(text),packed=deflateRawSync(plain),crc=crc32(plain),local=Buffer.alloc(30),central=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(plain.length,22);local.writeUInt16LE(filename.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(plain.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  chunks.push(local,filename,packed);directory.push(central,filename);offset+=local.length+filename.length+packed.length;
 }
 const dir=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,dir,end]);
}
const strings=['Start Time','1/10 Hour','End Time','Duration','Mjr Ops Code','Description','Operation','Com ','WORKOVER','DRILL OUT PLUG','WOV_DOP','Well Name','Test well'];
const activities=[['23:49','06:00',6.183,'First plug\n4.0 BPM & <notes> "quoted"'],['06:00','10:40',4.667,'Next plugs'],['10:40','20:30',9.833,'Long interval'],['20:30','03:15',6.75,'Second midnight crossing'],['03:15','06:00',2.75,'Last plugs']];
function files(sheetName='DO TimeLog',revised=false){
 let rows='<row r="6">'+Object.entries({B:0,C:1,D:2,E:1,F:3,G:4,H:5,I:6,J:7}).map(([c,i])=>cell(c+'6',i,'s')).join('')+'</row><row r="8">'+cell('F8','[hrs]','inlineStr')+'</row>';
 activities.forEach(([start,end,hours,comment],i)=>{const r=i+9,clock=t=>{const [h,m]=t.split(':').map(Number);return (h*60+m)/1440};rows+=`<row r="${r}">`+cell('B'+r,clock(start))+cell('D'+r,clock(end))+cell('F'+r,hours)+cell('G'+r,8,'s')+cell('H'+r,9,'s')+`<c r="I${r}" t="str"><f>"WOV_DOP"</f><v>WOV_DOP</v></c>`+cell('J'+r,revised&&i===0?'Revised loader comment':comment,'inlineStr')+'</row>'});
 rows+='<row r="14">'+cell('G14',8,'s')+cell('H14',9,'s')+cell('I14',10,'s')+'</row>';
 return {
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/><sheet name="Setup and Post-Job" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
  'xl/sharedStrings.xml':`<sst xmlns="${ns}">${strings.map(s=>'<si><t xml:space="preserve">'+escape(s)+'</t></si>').join('')}</sst>`,
  'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}"><sheetData>${rows}</sheetData></worksheet>`,
  'xl/worksheets/sheet2.xml':`<worksheet xmlns="${ns}"><sheetData><row r="3">${cell('A3',11,'s')}${cell('B3',12,'s')}</row></sheetData></worksheet>`
 };
}
for(const [name,parts]of [['loader-clock-times.xlsx',files()],['loader-revised.xlsx',files('DO TimeLog',true)],['loader-missing-sheet.xlsx',files('Another sheet')]])fs.writeFileSync(path.join(output,name),zip(parts));
fs.writeFileSync(path.join(output,'not-a-workbook.xlsx'),'Not an Excel archive');
const root=new URL('../../index.html',import.meta.url),html=fs.readFileSync(root,'utf8'),match=html.match(/(<script type="application\/json" id="planner-data">)([\s\S]*?)(<\/script>)/),seed=JSON.parse(match[2]);
seed.docId='loader-browser-smoke';seed.title='Test well';seed.setup={...seed.setup,rig:'Test rig',start:'2026-09-29T20:00'};delete seed.wells;delete seed.preOpsRecovery;delete seed.importDetails;
seed.phases=seed.phases.map((p,i)=>({...p,id:'smoke-phase-'+i,type:p.name,mode:'duration',collapsed:false,rows:i===2?[{id:'manual-activity',duration:0.5,target:1,end:null,category:'WORKOVER',desc:'CIRCULATE',code:'WOV_CIRC',com:'Manual entry stays editable',logistics:'Keep crew note',sshe:'Keep safety note'}]:[{id:'manual-phase-'+i,duration:i<2?i+1:0.5,target:1,end:null,category:'WORKOVER',desc:'CIRCULATE',code:'WOV_CIRC',com:'Untouched phase '+i,logistics:'',sshe:''}]}));
const isolated=html.replace(match[0],match[1]+JSON.stringify(seed).replace(/</g,'\\u003c')+match[3]);fs.writeFileSync(path.join(output,'planner.html'),isolated);
const endTimeSeed=structuredClone(seed);endTimeSeed.docId='loader-downstream-end-time-smoke';
endTimeSeed.phases[3].rows.push({...endTimeSeed.phases[3].rows[0],id:'tooh-second-activity',duration:10.75,com:'Pull out of hole',logistics:'Keep TOH crew reminder'});
let timeline=Date.parse(endTimeSeed.setup.start+'Z');
endTimeSeed.phases.forEach((phase,i)=>{
 if(i===3||i===5)phase.mode='date';
 phase.rows.forEach(row=>{timeline+=row.duration*3600000;if(phase.mode==='date'){row.end=new Date(timeline).toISOString().slice(0,16);row.duration=null}});
});
fs.writeFileSync(path.join(output,'planner-end-times.html'),html.replace(match[0],match[1]+JSON.stringify(endTimeSeed).replace(/</g,'\\u003c')+match[3]));
console.log('Created isolated planner and four local workbook fixtures in '+output);
