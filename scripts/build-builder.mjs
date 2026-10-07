import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const planner = fs.readFileSync(new URL('index.html', root), 'utf8');
const dataPattern = /<script type="application\/json" id="planner-data">([\s\S]*?)<\/script>/;
const original = JSON.parse(planner.match(dataPattern)[1]);
const blank = {
  version: 1, docId: 'builder-template', updated: 0, title: '',
  setup: {rig: '', start: '', formation: '', lateral: null, spacing: null, plugs: null, pre: 8, prod: 24, post: 8, targetBasis: 'midland-new'},
  wells: [], phases: [], ops: original.ops, refs: original.refs, targetReference: original.targetReference,
  activityTemplates: JSON.parse(fs.readFileSync(new URL('scripts/phase-templates.json', root), 'utf8')),
  hiddenColumns: ['code'], opsHiddenDefaultApplied: true, columnLayoutVersion: 3,
  columnWidths: original.columnWidths
};
// Carry the current planner code and references without the example job or recovery data.
let template = planner.replace(dataPattern, () => '<script type="application/json" id="planner-data">' + JSON.stringify(blank).replace(/</g, '\\u003c') + '</script>');
for (const [tag, name, text] of [
  ['h1', 'jobTitle', 'Time Planner'], ['div', 'jobMeta', ''], ['div', 'phaseCount', ''],
  ['span', 'rowStatus', ''], ['p', 'setupAttainmentSummary', ''],
  ['section', 'setupScoreboard', ''], ['section', 'scoreboard', '']
]) {
  template = template.replace(new RegExp('(<'+tag+'[^>]*id="'+name+'"[^>]*>)[\\s\\S]*?(</'+tag+'>)'), (_, open, close) => open + text + close);
}
template = template.replace(/<title>[\s\S]*?<\/title>/, '<title>Time Planner</title>');
template = template.replace(/(<div class="metrics" id="metrics">)[\s\S]*?(<\/div><\/div>)(?=<div class="toolbar">)/, (_, open, close) => open + close);
const engine = fs.readFileSync(new URL('scripts/builder-engine.js', root), 'utf8');
const shell = fs.readFileSync(new URL('scripts/builder-shell.html', root), 'utf8');
const builder = shell.replace('<!-- BUILDER_ENGINE -->', () => '<script data-builder-engine>\n' + engine + '\n</script>')
  .replace('<!-- PLANNER_TEMPLATE -->', () => '<script type="text/plain" id="planner-template">' + Buffer.from(template).toString('base64') + '</script>');
fs.writeFileSync(new URL('builder.html', root), builder);
console.log('Built standalone builder.html with the current planner template.');
