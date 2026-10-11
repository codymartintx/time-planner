// Pure generation logic shared by the standalone builder and its checks.
const PlannerBuilder = (() => {
  const phaseTypes = ['Pre Ops', 'Trip in Hole', 'Drill Out', 'Trip Out of Hole', 'Set Production', 'Post Ops'];
  const dataPattern = /<script type="application\/json" id="planner-data">([\s\S]*?)<\/script>/;
  const round = value => Math.round(value * 1e8) / 1e8;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  // LAN HTTP pages lack randomUUID, but still expose getRandomValues.
  const id = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  };
  const productionMethods = ['HPGL', 'CGL', 'ESP & ESP-HR', 'GAPL'];
  const phaseLabel = type => type === 'Trip Out of Hole' ? 'TOH' : type;

  function selections(well, index = 0) {
    const chosen = well.phaseSelections || {};
    return {
      preOps: {firstWell: chosen.preOps?.firstWell ?? index === 0, motorBha: chosen.preOps?.motorBha ?? false},
      toh: {snub: chosen.toh?.snub ?? false, killMethod: chosen.toh?.killMethod || '10 KWF'},
      setProduction: {method: chosen.setProduction?.method || '', wlPackerEspCatch: chosen.setProduction?.wlPackerEspCatch ?? false}
    };
  }

  function planningSetup(well, index = 0) {
    const variables = selections(well, index);
    return {...well, pre: (variables.preOps.firstWell ? 8 : 4), prod: 24, phaseSelections: variables};
  }

  function readTemplate(encoded) {
    const html = new TextDecoder().decode(Uint8Array.from(atob(encoded.trim()), char => char.charCodeAt(0)));
    const match = html.match(dataPattern);
    if (!match) throw new Error('The planner template is missing. Rebuild the builder before creating a planner.');
    return {html, seed: JSON.parse(match[1])};
  }

  function phaseTargets(seed, setup) {
    const ref = seed.refs.find(item => item.formation === setup.formation);
    const band = [8500, 11500, 13500, 17500].filter(limit => setup.lateral >= limit).length;
    const rate = ref?.rates[band];
    const tih = ref ? ref.tih : null;
    const toh = ref ? ref.tooh[band] : null;
    return [setup.pre, tih, rate > 0 ? round(setup.lateral / rate * 24) : null, toh, 24, setup.post];
  }

  function activity(seed, code, duration, comment, extra = {}) {
    const operation = seed.ops.find(item => item.code === code);
    if (!operation) throw new Error('The activity template has an unknown operation code: ' + code);
    return {id:id(), category:operation.category, desc:operation.desc, code, duration, target:duration, targetWeightHours:duration, end:null, com:comment, logistics:'', sshe:'', ...extra};
  }

  function normalRows(seed, type, duration, chosen = {}) {
    const template = seed.activityTemplates[type].filter(row => Object.entries(row.when || {}).every(([path, value]) => path.split('.').reduce((selection, key) => selection?.[key], chosen) === value));
    const fixedWeight = template.reduce((sum, row) => sum + (row.weight === 'target' ? 0 : row.weight), 0);
    const weights = template.map(row => row.weight === 'target' ? Number.isFinite(duration) ? Math.max(0, duration - fixedWeight) : 1 : row.weight);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let used = 0;
    return template.map((row, index) => {
      const hours = !Number.isFinite(duration) ? null : index === template.length - 1 ? round(duration - used) : round(duration * weights[index] / total);
      used += hours;
      const extra = {};
      for (const key of ['category', 'desc', 'ingredientRow', 'planningPlaceholder', 'builderActivity']) if (row[key] !== undefined) extra[key] = row[key];
      return activity(seed, row.code, hours, row.com, extra);
    });
  }

const verificationCues = {
  "NUND_BOP": "- Equip. size & ratings suitable for job\n- COCs with matching serial numbers & acceptable dates",
  "TEST_BOP": "- Conduct function test, drawdown test & PSI test\n- Complete W01 Well Control Readiness checklists in Novara/KPA",
  "WOV_BHA": "BHA dimensions noted (OD, ID and length) and drifted",
  "WOV_RIH": "- Work string has been tallied and drifted\n- Work string has been either visually inspected or fully NDT inspected within an acceptable amount of work\n\n- Set & Test COFO\n- COCs for elevators, TIW valves\n- Equipment is fit for job (elevator sizing, load ratings)"
};
const jobHandoverCue = "Well Handover:\n- Notify frac of any equip left on loc.\n- Confirm correct well name & number\n- Review procedure, WellView history, and any other supporting docs\n\nCrew Readiness:\n- Fit for duty\n- Signed in, orientation complete, pre-tour meeting before\n- SSEs accounted for and managed according to policy\n\nSite:\n- Remote gas (H2S & LEL) monitoring system\n- Windsocks\n- Cones & chain for Red Zones\n- Muster signs & PSMS signage";
const rigVerificationCue = "Rig:\n- E-Kill (on RU and every 7 days)\n- DROPS components (pins, secondary retention)\n\nSupport Equip:\n- Internal Combustion Engines are RU according to equip spacing standards\n- Pump/FB iron tested withing 12 months with identifying bands\n- Pump/FB iron restrained according to standards\n- PRVs tested on fluid pumps\n- SDS available for all chems on location\n- All lifting equip has current certification with an identifying tag (slings, etc)";
function verificationCue(row, firstInJob = false) {
 const activity = row.code === 'NUND_BOP' && /\bND\b/i.test(row.com || '') ? '' : row.code === 'RURD' && /MIRU/i.test(row.com || '') ? rigVerificationCue : verificationCues[row.code] || '';
 return [firstInJob ? jobHandoverCue : '', activity].filter(Boolean).join('\n\n');
}
function applyVerificationCue(row, firstInJob = false) {
 const cue = verificationCue(row, firstInJob);
 // Refresh generated defaults while preserving user-entered verification notes.
 if (!row.sshe || row.sshe === row.generatedVerificationCue || row.sshe === 'W01 Well Control Readiness Check in Novara/KPA') {
  row.sshe = cue;
  row.generatedVerificationCue = cue;
 }
}

function productionLogisticsCue(code, method) {
  if (code !== 'WOV_POOH') return '';
  if (method === 'CGL' || method === 'HPGL') return `Dispatch ${method} vendors:\n- Spooler for CT line\n- GL equipment and personnel\n- Torque & Test`;
  if (['ESP', 'ESP-HR', 'ESP & ESP-HR'].includes(method)) return 'Dispatch ESP vendors:\n- Dual Spooler for CT line & ESP Cable\n- ESP equipment and personnel\n- ESP Consultant\n- Torque & Test';
  return '';
}

  function phasePlans(seed, well, index = 0) {
    const setup = planningSetup(well, index), chosen = setup.phaseSelections, targets = phaseTargets(seed, setup);
    const pre = normalRows(seed, 'Pre Ops', chosen.preOps.firstWell ? 8 : 4, chosen);
    const tih = normalRows(seed, 'Trip in Hole', targets[1], chosen);
    const toh = normalRows(seed, 'Trip Out of Hole', targets[3], chosen);
    const drill = normalRows(seed, 'Drill Out', targets[2], chosen);
    const production = [activity(seed, 'RURD_RUNPROD', 24, 'Set Production' + (chosen.setProduction.method ? ' — ' + chosen.setProduction.method : '') + '. Planning allowance; detailed activities to be defined.', {planningPlaceholder:'set-production'})];
    const rows = [pre, tih, drill, toh, production, normalRows(seed, 'Post Ops', setup.post)];
    rows.flat().forEach(row => {row.logistics = productionLogisticsCue(row.code, chosen.setProduction.method); applyVerificationCue(row, index === 0 && row === rows.flat()[0])});
    return phaseTypes.map((type, phaseIndex) => ({type, name:phaseLabel(type), target:targets[phaseIndex], rows:rows[phaseIndex], ...(type==='Set Production'?{productionMethod:chosen.setProduction.method}:{}), builderGenerated:true}));
  }

  function validate(seed, configuration) {
    const {start, wells} = configuration;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start || '') || !Number.isFinite(Date.parse(start + 'Z')) || new Date(start + 'Z').toISOString().slice(0, 16) !== start) {
      throw new Error('Enter a valid job start date and time.');
    }
    if (!Array.isArray(wells) || !wells.length) throw new Error('Enter at least one well.');
    wells.forEach((well, index) => {
      const label = 'Well ' + (index + 1);
      if (!String(well.title || '').trim()) throw new Error(label + ': enter a well name.');
      if (!seed.refs.some(ref => ref.formation === well.formation)) throw new Error(label + ': choose a formation.');
      for (const key of ['lateral', 'spacing']) {
        if (!Number.isFinite(well[key]) || well[key] <= 0) throw new Error(label + ': enter a positive ' + (key === 'lateral' ? 'lateral length.' : 'plug spacing.'));
      }
      if (!Number.isInteger(well.plugs) || well.plugs <= 0) throw new Error(label + ': enter a positive whole plug count.');
      for (const key of ['post']) {
        if (!Number.isFinite(well[key]) || well[key] < 0) throw new Error(label + ': target hours must be zero or positive.');
      }
      const chosen = selections(well, index);
      for (const value of [chosen.preOps.firstWell, chosen.preOps.motorBha, chosen.toh.snub, chosen.setProduction.wlPackerEspCatch]) {
        if (typeof value !== 'boolean') throw new Error(label + ': choose Yes or No for each phase variable.');
      }
      if (!['10 KWF', 'Top Kill'].includes(chosen.toh.killMethod)) throw new Error(label + ': choose a TOH kill method.');
      if (!productionMethods.includes(chosen.setProduction.method)) throw new Error(label + ': choose a Set Production method.');
    });
  }

  function create(template, configuration) {
    validate(template.seed, configuration);
    const seed = template.seed;
    const wells = configuration.wells.map((well, index) => ({
      id: id(), title: well.title.trim(), collapsed: false, standardCadence: true,
      setup: {formation: well.formation, lateral: well.lateral, spacing: well.spacing, plugs: well.plugs, pre: planningSetup(well,index).pre, prod: 24, post: well.post, targetBasis: 'midland-new', phaseSelections:selections(well,index)}
    }));
    const setup = {...wells[0].setup, rig: String(configuration.rig || '').trim(), start: configuration.start};
    wells[0].setup = {...setup};
    const state = {
      version: 1, docId: id(), updated: Date.now(), title: wells[0].title, setup, wells,
      phases: wells.flatMap((well,index) => phasePlans(seed, configuration.wells[index], index).map(({target,...phase}) => ({...phase,id:id(),wellId:well.id,mode:'duration',collapsed:false}))),
      ops: structuredClone(seed.ops), refs: structuredClone(seed.refs), targetReference: structuredClone(seed.targetReference),
      hiddenColumns: ['code'], opsHiddenDefaultApplied: true, columnLayoutVersion: 3,
      columnWidths: [...seed.columnWidths]
    };
    const json = JSON.stringify(state).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const heading = [setup.rig, wells.length === 1 ? wells[0].title : wells.length + ' wells'].filter(Boolean).join('; ');
    let html = template.html.replace(dataPattern, () => '<script type="application/json" id="planner-data">' + json + '<' + '/script>');
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + escapeHtml(heading) + ' · Time Planner</title>');
    html = html.replace(/(<h1 id="jobTitle">)[\s\S]*?(<\/h1>)/, (_, open, close) => open + escapeHtml(heading) + close);
    const filename = ('Time Planner - ' + (setup.rig || wells[0].title)).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 140) + '.html';
    return {html, state, filename};
  }

  return {readTemplate, phaseTargets, phasePlans, planningSetup, selections, validate, create, phaseTypes, phaseLabel, productionMethods, escapeHtml};
})();
