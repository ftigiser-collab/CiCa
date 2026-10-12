'use strict';
/* CiCa-Buddy – CVVHDF mit regionaler Citratantikoagulation nach Marburger Therapieempfehlung */
const VERSION = '1.1';
const VDATE = '12.10.2026';

/* ================= Zustand ================= */
const KEY = 'cica_set_v1', BKEY = 'cica_bga_v1', NKEY = 'cica_na_v1';
const DEF = {kg:75, bfr:100, cit:3.0, ca:80, dial:1000, sub:500, net:0, hkt:30, mg:1, koag:false, groesse:null, sex:'m'};
const LIM = {bfr:[60,180], cit:[1.5,4.5], ca:[5,200], dial:[0,2000], sub:[0,1500], net:[0,500], kg:[30,200], hkt:[15,60], mg:[0,5]};
const MARB = {bfr:[100,180], cit:[2.0,4.5], dial:[250,2000], sub:[200,1500]};

function load(k, d){ try{ const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; }catch(e){ return d; } }
function store(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
const S = Object.assign({}, DEF, load(KEY, {}));
const B = load(BKEY, {});
const NA = Object.assign({f:0.5, akut:false}, load(NKEY, {}));
function saveS(){ store(KEY, S); }
function saveB(){ store(BKEY, B); }

/* ================= Zahlen ================= */
const r1 = n => Math.round(n*10)/10;
const nf = (n, d) => (n == null || !isFinite(n)) ? '–' : n.toLocaleString('de-DE', {minimumFractionDigits:d, maximumFractionDigits:d}).replace(/^-/, '−');
const f0 = n => nf(Math.round(n), 0), f1 = n => nf(n, 1), f2 = n => nf(n, 2);
function num(v){ if(v == null || v === '') return null; const x = parseFloat(String(v).trim().replace(',', '.')); return isFinite(x) ? x : null; }
const DEC = {cit:1, mg:1};
const fv = (k, v) => DEC[k] ? f1(v) : f0(v);
const UNIT = {bfr:'ml/min', cit:'mmol/L', ca:'%', dial:'ml/h', sub:'ml/h', net:'ml/h', mg:'ml/h', kg:'kg', hkt:'%'};
const NAME = {bfr:'Blutfluss', cit:'Citrat', ca:'Ca²⁺-Ausgleich', dial:'Dialysat', sub:'Substituat', net:'Netto-Entzug', mg:'Mg²⁺-Perfusor', kg:'Gewicht', hkt:'Hämatokrit'};
const COL = {bfr:'var(--blood)', cit:'var(--ink)', ca:'var(--ca)', dial:'var(--dial)', sub:'var(--sub)', net:'var(--eff)', mg:'var(--ink3)', kg:'var(--ink3)', hkt:'var(--blood)'};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* Abgeleitete Größen – Formeln wie in der Marburger Empfehlung */
function D(s){
  s = s || S;
  const pbp = s.cit * s.bfr * 60 / 18;            // ml/h Prismocitrate 18 mmol/L
  const citH = s.cit * s.bfr * 60 / 1000;          // mmol Citrat/h
  const eff = pbp + s.dial + s.sub + s.net;        // Ablauf (Effluent) ml/h
  const conv = pbp + s.sub + s.net;                // konvektiver Anteil ml/h
  const plasma = s.bfr * 60 * (1 - s.hkt/100);
  return {
    pbp, citH, eff, conv,
    effDose: eff / s.kg, ufDose: conv / s.kg,
    ff: conv / (plasma + pbp) * 100,
    ffPost: (s.sub + s.net) / Math.max(1, plasma) * 100,   // Eindickung: Postdilution + Entzug je Plasmafluss
    hktEnd: s.hkt * (s.bfr*60) / Math.max(1, s.bfr*60 - s.sub - s.net)
  };
}
const withS = o => Object.assign({}, S, o);
const chg = (a, b, u) => a === b ? '' : ` (${a} → ${b} ${u})`;

/* ================= BGA-Felder ================= */
const BF = {
  ph:{l:'pH', u:'', p:[6.5,8]},
  be:{l:'BE', u:'mmol/L', p:[-35,35]},
  hco3:{l:'HCO₃⁻', u:'mmol/L', p:[2,60]},
  ica:{l:'Ca²⁺ Patient', u:'mmol/L', p:[0.2,2.5], ca:1},
  pf:{l:'Ca²⁺ postfilter', u:'mmol/L', p:[0.05,1.5], ca:1},
  na:{l:'Na⁺', u:'mmol/L', p:[100,190]},
  k:{l:'K⁺', u:'mmol/L', p:[1,10]},
  lac:{l:'Laktat', u:'mmol/L', p:[0,30]},
  tca:{l:'Gesamt-Ca', u:'mmol/L', p:[0.5,6]},
  cl:{l:'Cl⁻', u:'mmol/L', p:[60,150]},
  alb:{l:'Albumin', u:'g/dl', p:[0.5,60]},
  mgv:{l:'Mg²⁺', u:'mmol/L', p:[0.1,4]},
  po4:{l:'Phosphat', u:'mmol/L', p:[0.1,6]}
};
function bval(k){ const v = B[k]; if(v == null) return null; const p = BF[k].p; return (v < p[0] || v > p[1]) ? null : v; }
function fieldsHTML(keys){
  return '<div class="fields">' + keys.map(k => {
    const f = BF[k], v = B[k];
    return `<div class="field${f.ca?' ca':''}"><label for="b_${k}">${f.l} <span class="unit">${f.u}</span></label><input id="b_${k}" data-b="${k}" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${v != null ? String(v).replace('.', ',') : ''}"></div>`;
  }).join('') + '</div>';
}

/* ================= Regeln (Marburger Kurzanleitung) ================= */
// 4.2 Ca²⁺ im Patientenplasma → Anpassung Ca-Ausgleich (Prozentpunkte am Gerät)
const CA_BANDS = [
  {lab:'< 0,8', d:20, test:x => x < 0.8},
  {lab:'0,8–0,9', d:10, test:x => x < 0.9},
  {lab:'0,9–0,99', d:5, test:x => x < 1.0},
  {lab:'1–1,19', d:0, test:x => x < 1.195},
  {lab:'1,2–1,25', d:-5, test:x => x <= 1.255},
  {lab:'1,26–1,33', d:-10, test:x => x <= 1.335},
  {lab:'> 1,33', d:-20, test:() => true}
];
const caRule = x => { const i = CA_BANDS.findIndex(b => b.test(x)); return {i, d:CA_BANDS[i].d}; };
// 4.1 Ca²⁺ extrakorporal → Citratdosis. Bei kompromittierter plasmatischer Gerinnung toleriert Marburg bis 0,6.
const pfMax = () => S.koag ? 0.6 : 0.35;
const pfRule = x => x < 0.25 ? -0.5 : x <= pfMax() ? 0 : 0.5;

function abState(){
  const ph = bval('ph'), be = bval('be'), hco3 = bval('hco3');
  let met = null;
  if(be != null) met = be > 2.5 ? 'alk' : be < -2.5 ? 'azi' : 'ok';
  else if(hco3 != null) met = hco3 > 26 ? 'alk' : hco3 < 22 ? 'azi' : 'ok';
  const phs = ph == null ? null : ph > 7.45 ? 'alk' : ph < 7.35 ? 'azi' : 'ok';
  const dev = be != null ? Math.abs(be) : hco3 != null ? (hco3 > 26 ? hco3 - 26 : hco3 < 22 ? 22 - hco3 : 0) : 0;
  return {ph, be, hco3, met, phs, dev};
}
function abText(a){
  if(!a.met && !a.phs) return null;
  if(a.met === null) return {lvl:'info', t: a.phs === 'ok' ? 'pH normal' : `pH ${a.phs === 'azi' ? 'niedrig' : 'hoch'}`, a:'BE oder HCO₃⁻ fehlt – ohne sie lässt sich nicht sagen, ob die Störung metabolisch ist.'};
  if(a.met === 'alk' && a.phs === 'azi') return {lvl:'info', t:'BE hoch, pH niedrig', a:'Eher respiratorische Azidose mit metabolischer Kompensation – erst die Beatmung ansehen, nicht die CRRT.'};
  if(a.met === 'azi' && a.phs === 'alk') return {lvl:'info', t:'BE niedrig, pH hoch', a:'Eher respiratorische Alkalose mit Kompensation – kein CRRT-Problem.'};
  if(a.met === 'ok' && a.phs === 'azi') return {lvl:'info', t:'pH niedrig bei normalem BE', a:'Respiratorisch – die CRRT-Einstellung hilft hier nicht.'};
  if(a.met === 'ok' && a.phs === 'alk') return {lvl:'info', t:'pH hoch bei normalem BE', a:'Respiratorisch – die CRRT-Einstellung hilft hier nicht.'};
  if(a.met === 'ok') return {lvl:'ok', t:'Säure-Basen im Ziel'};
  if(a.met === 'alk') return {lvl: a.phs === 'alk' ? 'warn' : 'info', t: a.phs === 'alk' ? 'Metabolische Alkalose' : a.phs === 'ok' ? 'Alkalotische Tendenz, pH noch normal' : 'BE bzw. HCO₃⁻ erhöht, pH fehlt', p:'alkalose'};
  return {lvl: a.phs === 'azi' ? 'warn' : 'info', t: a.phs === 'azi' ? 'Metabolische Azidose' : a.phs === 'ok' ? 'Azidotische Tendenz, pH noch normal' : 'BE bzw. HCO₃⁻ erniedrigt, pH fehlt', p:'azidose'};
}

function accum(){
  const tca = bval('tca'), ica = bval('ica'), na = bval('na'), cl = bval('cl'), hco3 = bval('hco3'), lac = bval('lac');
  let alb = bval('alb'); if(alb != null && alb > 10) alb = alb / 10; // in g/L eingegeben
  const ratio = (tca != null && ica != null) ? tca / ica : null;
  const ag = (na != null && cl != null && hco3 != null) ? na - cl - hco3 : null;
  const agc = ag != null && alb != null ? ag + 2.5 * (4.0 - alb) : ag;
  const be = bval('be'), ph = bval('ph');
  const acid = (be != null && be < -2.5) || (ph != null && ph < 7.35) || (hco3 != null && hco3 < 22);
  const crit = [
    {l:'Verhältnis Gesamt-Ca zu Ca²⁺ > 2,4', v: ratio == null ? null : ratio > 2.4, val: ratio != null ? f2(ratio) : null},
    {l:'Gesamt-Ca > 3,0 mmol/L', v: tca == null ? null : tca > 3.0, val: tca != null ? f2(tca) : null},
    {l:'Ca²⁺-Ausgleich > 120 % (laut Ist-Einstellung)', v: S.ca > 120, val: f0(S.ca) + ' %'},
    {l:'Azidose mit erhöhter Anionenlücke', v: agc == null ? null : (acid && agc > 12), val: agc != null ? 'AG ' + f0(agc) + (alb != null ? ' (albuminkorr.)' : '') : null}
  ];
  const yes = crit.filter(c => c.v === true);
  const lacAcid = lac != null && lac >= 4 && acid;
  let level;
  if((ratio != null && ratio > 2.4) || (tca != null && tca > 3.0) || yes.length >= 2) level = 'bad';
  else if(yes.length === 1 || lacAcid) level = 'warn';
  else level = ratio != null ? 'ok' : 'unk';
  const reasons = yes.map(c => c.l + (c.val ? ' (' + c.val + ')' : ''));
  if(lacAcid) reasons.push(`Laktat ${f1(lac)} bei Azidose`);
  return {ratio, ag, agc, crit, yes, level, lac, reasons, susp: level === 'bad' || level === 'warn'};
}

/* ================= Plausibilität der Kombination ================= */
// Marburg-Tabelle: PBP = Dialysat = 10 × BFR (ml/h je ml/min), Substituat = 5 × BFR
function combos(s){
  s = s || S;
  const d = D(s), out = [];
  if(d.ffPost > 25) out.push({id:'ff', lvl:'bad', t:`Eindickung im Filter ${f0(d.ffPost)} %`, a:'Substituat und Netto-Entzug machen mehr als 25 % des Plasmaflusses aus – hohes Clotting-Risiko. Substituat oder Entzug senken bzw. Blutfluss erhöhen.'});
  else if(d.ffPost > 20) out.push({id:'ff', lvl:'warn', t:`Eindickung im Filter ${f0(d.ffPost)} %`, a:'Substituat und Netto-Entzug liegen über 20 % des Plasmaflusses – das Clotting-Risiko steigt.'});
  const fd = s.dial / (10 * s.bfr);
  if(fd > 1.5) out.push({id:'dr', lvl:'info', t:`Viel Dialysat für diesen Blutfluss (${f1(fd)}-fach der Marburg-Relation)`, a:`Die Tabelle nimmt bei ${f0(s.bfr)} ml/min ${f0(10 * s.bfr)} ml/h. Mehr Dialysat entfernt mehr Citrat: Neigung zu Azidose, mehr K⁺-, Phosphat- und Mg²⁺-Verlust, höherer Ca-Bedarf. Sinnvoll vor allem zur Korrektur einer Alkalose oder Hyperkaliämie.`});
  else if(fd < 0.5) out.push({id:'dr', lvl:'info', t:`Wenig Dialysat für diesen Blutfluss (${f1(fd)}-fach der Marburg-Relation)`, a:`Die Tabelle nimmt bei ${f0(s.bfr)} ml/min ${f0(10 * s.bfr)} ml/h. Mehr Citrat erreicht den Patienten: Neigung zu Alkalose, bei eingeschränkter Leber zur Akkumulation, weniger kleine Clearance. Sinnvoll vor allem zur Korrektur einer Azidose.`});
  if(d.effDose < 20) out.push({id:'dl', lvl:'warn', t:`Ablaufdosis ${f0(d.effDose)} ml/kg/h`, a:'Unter der S3-Dosis von 20–25 ml/kg/h – Pausen und Filterwechsel senken die gelieferte Dosis zusätzlich.'});
  if(d.ufDose > 35) out.push({id:'uh', lvl:'warn', t:`Konvektive Dosis ${f0(d.ufDose)} ml/kg/h`, a:'Deutlich über der Marburger UF-Dosis von 20–25 ml/kg/h, Richtung High-Volume-Hämofiltration (bei Sepsis laut S3 nicht empfohlen). Hohe Verluste an Elektrolyten, Aminosäuren und Medikamenten.'});
  else if(d.effDose > 45) out.push({id:'dh', lvl: d.effDose > 50 ? 'warn' : 'info', t:`Ablaufdosis ${f0(d.effDose)} ml/kg/h`, a:'Über dem Bereich der Marburg-Tabelle (38–42): mehr Verluste an Elektrolyten, Aminosäuren, Vitaminen und Medikamenten.'});
  if(s.bfr < 100) out.push({id:'bl', lvl:'info', t:`Blutfluss ${f0(s.bfr)} ml/min`, a:'Unter 100 nur in der Startphase oder bei sehr kleinem Patienten (Tabellenzeilen 50–55 kg). Langsamer Fluss fördert Clotting.'});
  return out;
}
function combosHTML(){
  const c = combos();
  if(!c.length) return '<ul class="res"><li class="ok"><b>Kombination plausibel</b><div class="act">Eindickung, Dialysat-Relation und Dosis im Rahmen.</div></li></ul>';
  return '<ul class="res">' + c.map(x => `<li class="${x.lvl}"><b>${x.t}</b><div class="act">${x.a}</div></li>`).join('') + '</ul>';
}

/* ================= Schrittlisten ================= */
const EMZ_BFR = 'Schrittweite 20 ml/min ist ein Praxis-Hinweis – Marburg nennt für den Blutfluss keine Zahl.';
function stepsAlk(){
  const s = S, pf = bval('pf'), out = [];
  const nd = Math.min(2000, s.dial + 250);
  out.push({title:'Dialysat erhöhen', k:'dial', to:nd,
    blocked: s.dial >= 2000 ? 'Obergrenze 2.000 ml/h erreicht.' : null,
    why:'Jeder Liter Dialysat nimmt Citrat-Calcium-Komplexe mit, bevor sie die Leber erreichen – dieses Citrat wird kein Bikarbonat mehr. Das Phoxilium bringt zwar selbst Bikarbonat mit (30 mmol/L), netto überwiegt aber der Citratverlust: Mehr Dialysat wirkt entalkalisierend. Wie stark, zeigt erst die BGA.',
    watch:`Ablaufdosis steigt${chg(f0(D().effDose), f0(D(withS({dial:nd})).effDose), 'ml/kg/h')}. Mehr kleine Clearance: K⁺, Phosphat und Mg²⁺ sinken eher. Den höheren Ca-Verlust gleicht der integrierte Ausgleich automatisch aus.`});
  const nc = r1(s.cit - 0.5);
  let bl = null;
  if(nc < 2.0) bl = 'Untergrenze 2,0 mmol/L erreicht.';
  else if(pf != null && pf > pfMax() - 0.05) bl = `Postfilter-Ca²⁺ liegt bei ${f2(pf)} – kaum Spielraum. Erst Dialysat oder Blutfluss. (Grenze 0,05 unter dem Maximum: Praxis-Hinweis)`;
  out.push({title:'Citrat senken', k:'cit', to:Math.max(2.0, nc), blocked:bl,
    why:`Weniger Citrat pro Liter Blut heißt weniger Bikarbonat-Vorläufer. Das Gerät senkt die PBP-Rate automatisch${chg(f0(D().pbp), f0(D(withS({cit:Math.max(2,nc)})).pbp), 'ml/h')}.`,
    watch:`Postfilter-Ca²⁺ nach 10 min: Es muss ≤ ${f2(pfMax())} bleiben, sonst clottet der Filter. Die Citratdosis gehört zuerst der Antikoagulation – für den Säure-Basen-Haushalt nur, wenn dort Spielraum ist.` + (pf == null ? ' Postfilter-Wert unbekannt – vorher messen.' : '')});
  const nb = Math.max(Math.min(100, s.bfr), s.bfr - 20);
  out.push({title:'Blutfluss senken', k:'bfr', to:nb,
    blocked: nb >= s.bfr ? (s.bfr < 100 ? `Blutfluss schon bei ${f0(s.bfr)} ml/min, unter der Marburger Untergrenze von 100.` : 'Untergrenze 100 ml/min erreicht.') : null,
    why:`Citrat ist an den Blutfluss gekoppelt: weniger Blut, proportional weniger Citrat${chg(f1(D().citH), f1(D(withS({bfr:nb})).citH), 'mmol/h')}. Dasselbe Dialysat entfernt dann einen größeren Anteil davon.`,
    watch:`PBP, Ablauf- und UF-Dosis sinken${chg(f0(D().ufDose), f0(D(withS({bfr:nb})).ufDose), 'ml/kg/h UF-Dosis')}. Bei kleinerem Blutfluss dickt das Blut im Filter stärker ein – Clotting-Risiko. Soll die Konvektion gleich bleiben, Substituat etwas erhöhen.`,
    emz: EMZ_BFR});
  return out;
}

function stepsAzi(){
  const s = S, A = accum(), a = abState(), pf = bval('pf'), k = bval('k'), lac = bval('lac'), na = bval('na'), out = [];
  const stop = A.level === 'bad' ? 'Akkumulation wahrscheinlich – ' : A.level === 'warn' ? 'Akkumulationshinweis – erst Gesamt-Ca und Ratio klären, ' : null;
  const nd = Math.max(250, s.dial - 250);
  out.push({title:'Dialysat senken', k:'dial', to:nd,
    blocked: stop ? stop + 'weniger Dialysat ließe mehr Citrat zum Patienten.' : s.dial <= 250 ? 'Untergrenze 250 ml/h erreicht.' : (k != null && k > 5.0) ? `K⁺ ${f1(k)} – Dialysat jetzt nicht senken, sonst steigt K⁺ weiter. Puffer lieber über NaBic.` : null,
    why:'Weniger Dialysat entfernt weniger Citrat im Filter – mehr davon erreicht die Leber und wird zu Bikarbonat. Dass gleichzeitig weniger Bikarbonat aus dem Phoxilium hereinkommt, wiegt netto weniger.',
    watch:`Kleine Clearance sinkt${chg(f0(D().effDose), f0(D(withS({dial:nd})).effDose), 'ml/kg/h Ablaufdosis')}: K⁺ und Harnstoff steigen eher.`});
  const nc = Math.min(4.5, r1(s.cit + 0.5));
  out.push({title:'Citrat erhöhen', k:'cit', to:nc,
    blocked: stop ? stop + 'kein zusätzliches Citrat.' : s.cit >= 4.5 ? 'Obergrenze 4,5 mmol/L erreicht.' : (pf != null && pf < 0.25) ? `Postfilter-Ca²⁺ ${f2(pf)} – schon unter 0,25. Mehr Citrat antikoaguliert nicht besser, es belastet nur.` : (lac != null && lac >= 4) ? `Laktat ${f1(lac)} – ob das Citrat noch verstoffwechselt wird, ist fraglich. (Schwelle 4: Praxis-Hinweis)` : null,
    why:'Mehr Citrat pro Liter Blut, also mehr Bikarbonat-Vorläufer – vorausgesetzt, die Leber baut es ab.',
    watch:'Marburg: Leberfunktion, Laktat und Leberwerte beachten. Postfilter-Ca²⁺ sinkt, der Ca-Bedarf steigt.' + (A.level === 'unk' ? ' Gesamt-Ca fehlt – Akkumulation ist nicht ausgeschlossen.' : '')});
  const nb = Math.min(180, s.bfr + 20);
  out.push({title:'Blutfluss erhöhen', k:'bfr', to:nb,
    blocked: stop ? stop + 'mehr Blutfluss bringt mehr Citrat.' : nb <= s.bfr ? 'Obergrenze 180 ml/min erreicht.' : null,
    why:`Mehr Blutfluss bringt absolut mehr Citrat${chg(f1(D().citH), f1(D(withS({bfr:nb})).citH), 'mmol/h')}, die PBP steigt automatisch, und dasselbe Dialysat entfernt davon anteilig weniger.`,
    watch:'Katheter und Ansaugdruck: Nicht jeder Zugang schafft 180 ml/min. Ablauf- und UF-Dosis steigen.',
    emz: EMZ_BFR});
  const be = bval('be');
  const need = be != null && be < 0 ? Math.abs(be) * S.kg * 0.3 : null;
  out.push({title:'Sonst puffern: NaBic 8,4 %',
    blocked: a.phs === 'ok' ? 'pH normal – Marburg: abweichende Bikarbonatwerte tolerieren, kein NaBic nötig.' : null,
    custom: need != null && a.phs !== 'ok' ? `<div class="change"><span class="tag" style="--c:var(--ink2)">NaBic 8,4 %</span> <span class="to">${f0(need/2)} ml</span> <span class="muted small">Kurzinfusion = die Hälfte des Bedarfs von ${f0(need)} mmol (|BE| × ${f0(S.kg)} kg × 0,3)</span></div>` : need == null ? `<p class="small muted">Bedarf (mmol) ≈ |BE| × kg × 0,3 – zunächst die Hälfte. BE eintragen, dann rechnet die App.</p>` : '',
    why:'Direkter Puffer, unabhängig vom Citratstoffwechsel. Marburg: bei ausgeprägter Azidose Kurzinfusion NaBic 8,4 % (1 mmol/ml).' + (a.phs === null ? ' pH fehlt – erst nachtragen, er entscheidet.' : ''),
    watch:'Entscheidend ist der pH, nicht der HCO₃⁻-Wert allein. Hyperosmolar (etwa 2.000 mosmol/L) – möglichst über ZVK. Natriumlast (1 mmol Na⁺ pro ml), CO₂-Anfall (Beatmung anpassen), das ionisierte Ca²⁺ sinkt bei Alkalisierung.' + (na != null && na > 145 ? ` <b>Na⁺ ${f0(na)}: NaBic verschärft die Hypernatriämie.</b>` : ''),
    emz: 'Die Formel |BE| × kg × 0,3 ist ein Praxis-Hinweis.'});
  return out;
}

/* ================= Bausteine ================= */
function tag(k){
  if(k === 'cit') return `<span class="tag pbp">${NAME[k]}</span>`;
  return `<span class="tag${k === 'net' ? ' eff' : ''}" style="--c:${COL[k]}">${NAME[k]}</span>`;
}
function changeHTML(k, from, to){
  return `<div class="change">${tag(k)} <span class="from">${fv(k, from)}</span><span class="arr" aria-label="auf">→</span><span class="to">${fv(k, to)}</span> <span class="muted small">${UNIT[k]}</span></div>`;
}
function applyBtn(obj, label){
  return `<div class="apply"><button class="btn sm ghost" type="button" data-apply='${esc(JSON.stringify(obj))}' data-label="${esc(label)}">Am Gerät umgestellt</button></div>`;
}
function stepHTML(st){
  let extra = '';
  if(st.k && st.to != null && st.to !== S[st.k] && !st.blocked){
    const before = new Set(combos().map(c => c.id + c.lvl));
    const neu = combos(withS({[st.k]: st.to})).filter(c => !before.has(c.id + c.lvl));
    const bad = neu.find(c => c.lvl === 'bad');
    if(bad) st = Object.assign({}, st, {blocked: `Ergäbe eine gefährliche Kombination – ${bad.t}. ${bad.a}`});
    else extra = neu.filter(c => c.lvl === 'warn').map(c => `<p class="combowarn"><b>Danach:</b> ${c.t}. ${c.a}</p>`).join('');
  }
  let h = `<li class="${st.blocked ? 'blocked' : ''}"><div class="stitle">${st.title}</div>`;
  if(st.k && st.to != null && st.to !== S[st.k]) h += changeHTML(st.k, S[st.k], st.to);
  if(st.custom) h += st.custom;
  if(st.blocked) h += `<p class="blockmsg">${st.blocked}</p>`;
  if(st.why) h += `<p class="why"><b>Warum:</b> ${st.why}</p>`;
  if(st.watch) h += `<p class="watch"><b>Achte auf:</b> ${st.watch}</p>`;
  if(extra) h += extra;
  if(st.emz && !st.blocked) h += `<p class="note eminenz">${st.emz}</p>`;
  if(st.k && !st.blocked && st.to != null && st.to !== S[st.k]) h += applyBtn({[st.k]:st.to}, `${NAME[st.k]} jetzt ${fv(st.k, st.to)} ${UNIT[st.k]}`);
  return h + '</li>';
}
const stepsHTML = arr => '<ol class="steps">' + arr.map(stepHTML).join('') + '</ol>';
const verdict = (lvl, t, txt) => `<div class="verdict ${lvl}"><b>${t}</b>${txt ? txt : ''}</div>`;
const note = (txt, em) => `<p class="note${em ? ' eminenz' : ''}">${txt}</p>`;
const EMZ = 'Praxis-Hinweis, nicht Teil des Marburger Protokolls.';
const CONTROL = '<p class="hint">Nach jeder Flussänderung: Postfilter-Ca²⁺ nach 10 min, BGA nach 1 h (Marburg).</p>';
const plink = (id, txt) => `<a href="#/p/${id}">${txt}</a>`;

/* ================= Probleme ================= */
const PROBS = [
  {id:'alkalose', g:'Säure-Basen', t:'Patient wird alkalotisch', d:'BE oder HCO₃⁻ steigt', c:'var(--dial)'},
  {id:'azidose', g:'Säure-Basen', t:'Patient wird azidotisch', d:'BE oder HCO₃⁻ fällt', c:'var(--dial)'},
  {id:'postfilter', g:'Calcium und Citrat', t:'Postfilter-Ca²⁺ nicht im Ziel', d:'Antikoagulation im Kreislauf', c:'var(--ink)'},
  {id:'patientca', g:'Calcium und Citrat', t:'Patienten-Ca²⁺ nicht im Ziel', d:'Ca²⁺-Ausgleich anpassen', c:'var(--ca)'},
  {id:'akkumulation', g:'Calcium und Citrat', t:'Verdacht auf Citratakkumulation', d:'Ratio, Ca-Bedarf, Anionenlücke', c:'var(--ink)'},
  {id:'clotting', g:'Filter und Dosis', t:'Filter clottet', d:'Kurze Laufzeit, steigende Drücke', c:'var(--blood)'},
  {id:'dosis', g:'Filter und Dosis', t:'Dosis und Clearance', d:'Ablaufdosis, Myoglobin, Gewichtstabelle', c:'var(--eff)'},
  {id:'natrium', g:'Elektrolyte', t:'Natrium zu hoch oder zu niedrig', d:'Korrekturtempo abschätzen', c:'var(--eff)'},
  {id:'kalium', g:'Elektrolyte', t:'Kalium zu hoch oder zu niedrig', d:'Dialysat oder Perfusor', c:'var(--dial)'},
  {id:'magnesium', g:'Elektrolyte', t:'Magnesium', d:'Perfusor titrieren', c:'var(--ink3)'},
  {id:'phosphat', g:'Elektrolyte', t:'Phosphat', d:'Korrektur über das Substituat', c:'var(--sub)'},
  {id:'leber', g:'Besondere Lagen', t:'Leberversagen oder hohes Laktat', d:'Citrat vorsichtig fahren', c:'var(--ink)'},
  {id:'pause', g:'Besondere Lagen', t:'Pause, Transport, Stopp', d:'Was weiterläuft und was nicht', c:'var(--ink3)'}
];
const PG = {};

PG.alkalose = {
  inputs:['ph','be','hco3','pf','ica'],
  intro:`<p class="lead">Unter CiCa kommt der Puffer fast nur über das Citrat: Was den Filter passiert, bauen Leber und Muskel zu Bikarbonat ab (1 mmol Citrat ergibt 3 mmol HCO₃⁻). Kommt mehr Citrat an als nötig, steigt der BE. Jeder Hebel verringert entweder die Citratmenge oder holt mehr davon im Filter wieder heraus.</p>
  <div class="target"><span>Ziel BE <b>−2,5 bis +2,5</b></span><span>HCO₃⁻ <b>22–26 mmol/L</b></span></div>`,
  out(){
    const a = abState(); let h = '';
    if(a.met === 'alk'){
      h += verdict(a.phs === 'alk' ? 'warn' : 'info', a.phs === 'alk' ? 'Metabolische Alkalose' : 'Alkalotische Tendenz, pH noch normal', a.phs === 'alk' ? '' : '<br>Ein Schritt ist vertretbar – oder den Trend über 2–3 BGAs abwarten.');
    } else if(a.met) {
      const t = abText(a); h += verdict(t.lvl === 'ok' ? 'ok' : 'info', t.t, t.a ? '<br>' + t.a : (a.met === 'azi' ? `<br>Das ist die andere Richtung: ${plink('azidose','Azidose')}.` : ''));
    } else h += verdict('none', 'Schritte nach Marburg', '<br>BE oder HCO₃⁻ eintragen, dann prüft die App die Richtung.');
    h += stepsHTML(stepsAlk());
    if(a.met === 'alk' && a.dev > 5) h += note('Bei deutlicher Abweichung (BE über +5) kannst du Schritt 1 und 2 gleichzeitig machen. ' + EMZ, true);
    return h + CONTROL;
  },
  after:`<div class="box"><h3>Wenn die Hebel ausgereizt sind</h3><p>Marburg: Die Laufraten verbessern den Säure-Basen-Haushalt nur, wenn die Störung von der CVVHDF kommt. Andere Ursachen:</p><ul>
  <li>Magensaftverlust (Sonde auf Ablauf, Erbrechen)</li>
  <li>Puffer von außen: NaBic, Laktat oder Azetat in Infusionen, Citrat aus Blutprodukten</li>
  <li>Hypokaliämie, Hypochlorämie, Volumenkontraktion nach Diuretika</li>
  <li>Posthyperkapnisch nach Umstellung der Beatmung</li>
  <li>Niedriges Albumin: weniger schwache Säure, BE rechnerisch höher (Stewart)</li></ul>
  <p class="small muted">Acetazolamid wirkt über die Niere – bei Anurie wirkungslos.</p></div>
  <div class="box"><h3>Calcium mitdenken</h3><p>Alkalose senkt das ionisierte Ca²⁺, weil mehr Calcium an Albumin bindet. Patienten-Ca²⁺ deshalb mitkontrollieren: ${plink('patientca','Ca²⁺-Ausgleich anpassen')}.</p></div>`
};

PG.azidose = {
  inputs:['ph','be','hco3','lac','pf','ica','tca','k'],
  intro:`<p class="lead">Kommt zu wenig Citrat beim Patienten an – oder holt der Filter zu viel davon heraus –, fehlt Puffer. Aber eine Azidose unter CiCa kann auch das Gegenteil bedeuten: Citrat wird nicht mehr abgebaut und häuft sich an. Dann wäre mehr Citrat genau falsch. Deshalb erst prüfen, dann drehen.</p>
  <div class="target"><span>Ziel BE <b>−2,5 bis +2,5</b></span><span>HCO₃⁻ <b>22–26 mmol/L</b></span></div>`,
  out(){
    const a = abState(), A = accum(); let h = '';
    if(A.level === 'bad') h += verdict('bad', 'Erst stoppen: Citratakkumulation wahrscheinlich', `<br>${A.reasons.join(', ')}. Diese Azidose ist kein Puffermangel aus der CRRT – kein zusätzliches Citrat, ${plink('akkumulation','Maßnahmen bei Akkumulation')}.`);
    else if(A.level === 'warn') h += verdict('warn', 'Akkumulationshinweis – CRRT-Schritte gesperrt', `<br>${A.reasons.join(', ')}. Erst Gesamt-Ca und Ratio klären – ${plink('akkumulation','Check')}.`);
    else if(A.level === 'unk') h += verdict('info', 'Zuerst: Akkumulation ausschließen', '<br>Gesamt-Ca und Ca²⁺ Patient eintragen, dann rechnet die App die Ratio. Ohne Gesamt-Ca bei Leberversagen, Schock oder steigendem Laktat nicht blind Citrat erhöhen.');
    else h += verdict('ok', `Keine Akkumulation (Ratio ${f2(A.ratio)})`, '');
    const t = abText(a);
    if(t) h += verdict(t.lvl === 'ok' ? 'ok' : t.lvl, t.t, t.a ? '<br>' + t.a : a.met === 'alk' ? `<br>Das ist die andere Richtung: ${plink('alkalose','Alkalose')}.` : a.phs === 'ok' ? '<br>Marburg: Ist der pH normal, dürfen abweichende Bikarbonatwerte toleriert werden.' : '');
    const lac = bval('lac'); if(lac != null && lac >= 2) h += note(`Laktat ${f1(lac)} mmol/L: Ursache suchen (Schock, Ischämie). ${lac >= 4 ? 'Ab hier ist fraglich, ob Citrat noch verstoffwechselt wird.' : 'Trend beobachten.'}`);
    h += stepsHTML(stepsAzi());
    return h + CONTROL;
  },
  after:`<div class="box"><h3>Andere Ursachen bedenken</h3><ul>
  <li>Laktat: Schock, Ischämie (Darm, Extremität), Volumenmangel</li>
  <li>Ketoazidose, Intoxikation</li>
  <li>Hyperchlorämie nach viel NaCl 0,9 %</li>
  <li>Bikarbonatverlust über Darm oder Fisteln</li>
  <li>Hypoventilation – dann ist es respiratorisch</li></ul></div>`
};

const KOAG = () => `<label class="row small" style="margin:4px 0 12px;gap:8px"><input type="checkbox" data-koag${S.koag ? ' checked' : ''} style="width:20px;height:20px"> Plasmatische Gerinnung kompromittiert (z. B. Leberversagen) – Postfilter bis 0,6 tolerieren (Marburg)</label>`;
PG.postfilter = {
  inputs:['pf','tca','ica'],
  form: KOAG,
  intro:`<p class="lead">Der Postfilter-Wert zeigt, wie gut der Kreislauf antikoaguliert ist. Gerinnung braucht freies Ca²⁺, Citrat fängt es weg. Über 0,35 mmol/L arbeitet die Gerinnung im Filter wieder; unter 0,25 wird nicht besser antikoaguliert – der Patient bekommt nur mehr Citrat ab.</p>
  <div class="tw"><table><thead><tr><th>Ca²⁺ postfilter</th><th>&lt; 0,25</th><th>0,25–0,35</th><th>&gt; 0,35</th></tr></thead><tbody><tr><td>Citratdosis</td><td>−0,5 mmol/L</td><td>keine Änderung</td><td>+0,5 mmol/L</td></tr></tbody></table></div>`,
  out(){
    const pf = bval('pf'), A = accum();
    if(pf == null) return verdict('none', 'Postfilter-Ca²⁺ eintragen', '<br>Die App sucht dann die Zeile der Marburger Tabelle heraus.') + CONTROL;
    const d = pfRule(pf); let h = '';
    if(d === 0) return verdict('ok', `${f2(pf)} mmol/L – ${pf > 0.35 ? 'toleriert (kompromittierte Gerinnung, bis 0,6)' : 'im Ziel'}`, '<br>Keine Änderung der Citratdosis.') + CONTROL;
    if(d < 0){
      const to = Math.max(A.level === 'bad' ? 1.5 : 2.0, r1(S.cit - 0.5));
      h += verdict('warn', `${f2(pf)} mmol/L – mehr Citrat als nötig`, '');
      h += stepsHTML([{title:'Citrat senken', k:'cit', to, blocked: S.cit <= (A.level === 'bad' ? 1.5 : 2.0) ? 'Untergrenze erreicht – Messort prüfen (siehe unten).' : null,
        why:'Unter 0,25 bindet das Citrat schon fast alles Ca²⁺ – zusätzliches Citrat verbessert die Antikoagulation nicht, es landet nur als Puffer und Ca-Fänger im Patienten.',
        watch:'Etwas weniger Pufferlast (BE kann sinken). Kontrolle nach 10 min.'}]);
    } else {
      if(A.susp){
        h += verdict('warn', `${f2(pf)} mmol/L – bei Akkumulations${A.level === 'bad' ? 'gefahr' : 'hinweis'} tolerieren`, `<br>Citrat jetzt nicht erhöhen (${A.reasons.join(', ')}). Höhere Postfilter-Werte und eine kürzere Filterlaufzeit sind der Preis – ${plink('akkumulation','Akkumulation')}.`);
      } else {
        h += verdict('warn', `${f2(pf)} mmol/L – Kreislauf zu wenig antikoaguliert`, '');
        h += stepsHTML([{title:'Citrat erhöhen', k:'cit', to:Math.min(4.5, r1(S.cit + 0.5)), blocked: S.cit >= 4.5 ? 'Obergrenze 4,5 mmol/L erreicht – Ursachen prüfen (siehe unten).' : null,
          why:'Mehr Citrat bindet mehr Ca²⁺ im Kreislauf – die Gerinnung im Filter wird gebremst.',
          watch:'Mehr Citrat heißt mehr Pufferlast (Alkalose-Tendenz) und mehr Ca-Bedarf. Bei Leberversagen oder steigendem Laktat zurückhaltend.'}]);
      }
    }
    return h + CONTROL;
  },
  after:`<div class="box"><h3>Wenn der Wert nicht passt</h3><ul>
  <li>Abnahme am Postfilter-Port des Sets, nicht systemisch. Ein falscher Entnahmeort liefert Unsinn.</li>
  <li>Citrat schon bei 4,5 und weiter über 0,35: Messung wiederholen. Ist das Patienten-Ca²⁺ hoch, zuerst den Ca²⁺-Ausgleich senken – mehr Ca²⁺ im ankommenden Blut braucht mehr Citrat.</li>
  <li>Leberversagen mit eingeschränkter plasmatischer Gerinnung: Marburg toleriert dann Postfilter-Werte bis 0,6 mmol/L, ohne dass der Filter clottet.</li></ul></div>`
};

PG.patientca = {
  inputs:['ica','tca'],
  intro:`<p class="lead">Citrat-Calcium-Komplexe verlassen den Körper über das Effluent. Das Gerät berechnet diesen Verlust und gibt einen eingestellten Prozentsatz davon als Ca-Gluconat 10 % (0,23 mmol/ml) über die Spritze zurück. Ändern sich die Flüsse, rechnet es selbst nach – du stellst nur den Prozentsatz ein.</p>`,
  out(){
    const x = bval('ica');
    const hi = x != null ? caRule(x).i : -1;
    let h = `<div class="tw"><table><thead><tr><th>Ca²⁺ Patient</th>${CA_BANDS.map((b, i) => `<th class="${i === hi ? 'hit' : ''}">${b.lab}</th>`).join('')}</tr></thead><tbody><tr><td>Ca-Ausgleich</td>${CA_BANDS.map((b, i) => `<td class="${i === hi ? 'hit' : ''}">${b.d === 0 ? 'keine' : (b.d > 0 ? '+' : '−') + Math.abs(b.d) + ' %'}</td>`).join('')}</tr></tbody></table></div>`;
    if(x == null) return h + verdict('none', 'Ca²⁺ Patient eintragen', '<br>Die App markiert die Spalte und rechnet den neuen Prozentwert.');
    const {d} = caRule(x);
    if(d === 0) return h + verdict('ok', `${f2(x)} mmol/L – keine Änderung`, '');
    const to = Math.max(5, S.ca + d);
    const word = d === 5 ? 'knapp unter dem Ziel' : d === -5 ? 'obere Zielhälfte, leicht zurücknehmen' : d > 0 ? 'zu niedrig' : 'zu hoch';
    h += verdict(Math.abs(d) >= 20 ? 'bad' : Math.abs(d) === 5 ? 'info' : 'warn', `${f2(x)} mmol/L – ${word}`, '');
    const st = [{title: d > 0 ? 'Ca²⁺-Ausgleich erhöhen' : 'Ca²⁺-Ausgleich senken', k:'ca', to,
      why: d > 0 ? 'Der Ersatz deckt den Verlust über das Effluent nicht – mehr Prozent zurückgeben.' : 'Es kommt mehr Calcium zurück, als verloren geht – Prozentsatz senken.',
      watch: to > 120 ? 'Neuer Wert über 120 %: Steigender Ca-Bedarf ist ein Akkumulationszeichen. Gesamt-Ca bestimmen – ' + plink('akkumulation','Check') + '.' : 'BGA nach 1 h.'}];
    h += stepsHTML(st);
    if(x < 0.8) h += note('Unter 0,8 oder bei Rhythmusstörungen, Hypotonie oder Krämpfen zusätzlich einen Ca-Bolus erwägen. Ca-Chlorid nur über ZVK. ' + EMZ, true);
    return h;
  },
  after:`<div class="box"><h3>Gut zu wissen</h3><ul>
  <li>Marburg nennt als Ziel 1,1–1,3 mmol/L, die Tabelle lässt aber 1,00–1,19 unverändert. Das verhindert ständiges Nachregeln.</li>
  <li>Die Tabelle nennt ±%. Die App liest das als Prozentpunkte der Geräteeinstellung (80 → 90 %), wie in Prismaflex-Protokollen üblich – das ist eine Auslegung.</li>
  <li><b>Ca-Spritze leer oder gestoppt, Citrat läuft weiter:</b> rasche, schwere Hypokalzämie. Spritzenwechsel zügig, Citrat nie ohne Ca²⁺-Ausgleich.</li>
  <li>Plötzlich sehr niedriger Wert ohne Erklärung: Kontrollprobe. Citrat in der Probe (Entnahme nahe dem Citratzulauf, Rezirkulation bei vertauschten Katheterlumen) täuscht eine Hypokalzämie vor.</li>
  <li>Alkalose senkt das ionisierte Ca²⁺.</li>
  <li>Steigt der Bedarf über 120 %, geht Calcium nicht nur verloren, sondern wird im Patienten von liegengebliebenem Citrat gebunden: ${plink('akkumulation','Akkumulation prüfen')}.</li></ul></div>`
};

PG.akkumulation = {
  inputs:['tca','ica','ph','be','hco3','na','cl','alb','lac'],
  intro:`<p class="lead">Citrat wird in Leber und Muskel abgebaut – das braucht Sauerstoff und eine funktionierende Leber. Bei schwerem Leberversagen oder schwerer Hypoxie bleibt es liegen. Es bindet weiter Ca²⁺: Das ionisierte Ca²⁺ fällt, das Gerät gibt mehr Calcium, das Gesamt-Ca steigt. Und weil Citrat selbst ein Anion ist und kein Bikarbonat daraus wird, entsteht eine Azidose mit Anionenlücke.</p>`,
  out(){
    const A = accum(); let h = '';
    if(A.level === 'bad') h += verdict('bad', 'Citratakkumulation wahrscheinlich', `<br>${A.reasons.join(', ')}.`);
    else if(A.level === 'warn') h += verdict('warn', 'Verdacht – weiter abklären', `<br>${A.reasons.join(', ')}. ${A.ratio == null ? 'Gesamt-Ca und Ca²⁺ Patient fehlen für die Ratio.' : 'Ratio noch unter 2,4 – Trend verfolgen.'}`);
    else if(A.level === 'ok') h += verdict('ok', `Kein Hinweis (Ratio ${f2(A.ratio)})`, '');
    else h += verdict('none', 'Gesamt-Ca und Ca²⁺ Patient eintragen', '<br>Die Ratio ist das wichtigste Zeichen.');
    h += '<ul class="check">' + A.crit.map(c => `<li><span class="dot ${c.v === true ? 'y' : c.v === false ? 'n' : 'q'}" aria-hidden="true">${c.v === true ? '!' : c.v === false ? '✓' : '?'}</span><span>${c.l}${c.val ? ` <span class="muted">– ${c.val}</span>` : ''}${c.v === null ? ' <span class="muted">– Werte fehlen</span>' : ''}</span></li>`).join('') + '</ul>';
    if(A.lac != null) h += note(`Laktat ${f1(A.lac)} mmol/L${A.lac >= 2 ? ' – steigendes Laktat plus Ratio über 2,4 ist laut Marburg das Signal, Citrat maximal zu reduzieren.' : '.'}`);
    if(A.level === 'bad' || A.level === 'warn'){
      const tc = S.cit > 2.0 ? 2.0 : 1.5;
      const st = [
        {title:'Citratbelastung reduzieren', k:'cit', to:tc, blocked: S.cit <= 1.5 ? 'Schon bei 1,5 mmol/L – nächster Schritt: Citrat beenden.' : null,
          why:'Weniger Citrat, das liegen bleibt. Marburg: Citratdosis auf 1,5–2,0 mmol/L.',
          watch:'Postfilter-Ca²⁺ steigt über 0,35 – das wird bewusst in Kauf genommen, der Filter läuft kürzer.'},
        {title:'Ggf. Blutfluss senken', k:'bfr', to:Math.max(Math.min(100, S.bfr), S.bfr - 20), blocked: S.bfr <= 100 ? 'Untergrenze 100 ml/min erreicht.' : null,
          why:'Weniger Blutfluss heißt weniger Citrat pro Stunde, weil die PBP gekoppelt ist.',
          watch:'Dosis sinkt, Eindickung im Filter steigt.', emz: EMZ_BFR},
        {title:'Keine Normalisierung: Citrat beenden',
          custom:'<p>Marburg: Wenn sich die Werte nicht normalisieren, Citrat beenden. S3-Leitlinie: bei refraktärer Akkumulation auf ein bikarbonatgepuffertes Verfahren wechseln, ggf. ohne Antikoagulation.</p>',
          why:'Liegengebliebenes Citrat lässt sich nur durch weniger Zufuhr loswerden – oder es wird doch noch abgebaut, wenn Leber und Kreislauf sich erholen.',
          watch:'Rebound: Wird das liegengebliebene Citrat doch abgebaut, wird das gebundene Calcium frei (Ca²⁺-Ausgleich engmaschig senken, sonst Hyperkalzämie) und es entsteht Bikarbonat (metabolische Alkalose möglich).'}
      ];
      h += stepsHTML(st);
      h += note('Andere Protokolle erhöhen zusätzlich das Dialysat, um mehr Citrat im Filter zu entfernen (z. B. +500 ml/h). ' + EMZ, true);
      h += '<p class="hint">Neubewertung nach etwa 2 h: Ratio, Laktat, BGA (Zeitraum aus dem Prismocitrate-Studienprotokoll, nicht aus Marburg).</p>';
    }
    return h;
  },
  after:`<div class="box"><h3>Grenzwerte</h3><p>Ratio-Grenze: Marburg über 2,4, Fachinfo Regiocit über 2,3, in der Literatur 2,1–2,5. Der Trend sagt mehr als ein Einzelwert. Anionenlücke hier: Na⁺ − Cl⁻ − HCO₃⁻, auffällig über 12; mit Albumin wird korrigiert (+2,5 je g/dl unter 4).</p>
  <p class="small muted">Hohe Gefahr bei schwerem Leberversagen und schwerer Hypoxie (Marburg 6.1). Ein Akkumulationsverdacht ist der Grund, warum eine Azidose unter CiCa nie reflexhaft mit mehr Citrat behandelt wird.</p></div>`
};

PG.clotting = {
  inputs:['pf'],
  intro:`<p class="lead">Clottet ein Filter unter CiCa früh, liegt es meist an zu wenig Citrat im Kreislauf, an Stillstand, am Zugang oder an zu starker Eindickung im Filter. Die Reihenfolge unten geht vom häufigsten zum seltensten.</p>`,
  out(){
    const pf = bval('pf'), d = D();
    let first;
    if(pf == null) first = {title:'Postfilter-Ca²⁺ messen', custom:'<p>Über 0,35 ist der Kreislauf zu wenig antikoaguliert – das ist der häufigste Grund.</p>', why:'Ohne diesen Wert weißt du nicht, ob es am Citrat liegt.'};
    else if(pfRule(pf) > 0 && accum().susp) first = {title:`Postfilter-Ca²⁺ ${f2(pf)} – trotzdem kein Citrat mehr`, custom:`<p>Es gibt Akkumulationshinweise (${accum().reasons.join(', ')}). Kürzere Filterlaufzeit in Kauf nehmen – ${plink('akkumulation','Akkumulation')}.</p>`};
    else if(pfRule(pf) > 0) first = {title:`Postfilter-Ca²⁺ ${f2(pf)} – Citrat erhöhen`, k:'cit', to:Math.min(4.5, r1(S.cit + 0.5)), blocked: S.cit >= 4.5 ? 'Obergrenze 4,5 mmol/L – siehe Postfilter-Seite.' : null, why:'Zu wenig Citrat im Kreislauf, die Gerinnung läuft im Filter wieder an.', watch:'Kontrolle nach 10 min.'};
    else first = {title:`Postfilter-Ca²⁺ ${f2(pf)} – Citrat ist nicht das Problem`, custom:'<p>Die Antikoagulation reicht. Weiter mit den nächsten Punkten.</p>'};
    const st = [first,
      {title:'Stillstand vermeiden', custom:'<p>Alarme rasch beheben, Beutelwechsel zügig. Jede Minute ohne Fluss gerinnt.</p>', why:'Citrat wirkt nur, solange Blut und Citrat fließen.'},
      {title:'Zugang prüfen', custom:'<p>Stark negativer Ansaugdruck, Katheterlage, Knick. Vertauschte Lumen erhöhen die Rezirkulation.</p>', why:'Ein schlechter Zugang bremst den Fluss und verfälscht obendrein die Ca-Werte.'},
      {title:'Blutfluss nicht zu langsam', custom:'<p>Start mit 60 ml/min, bei stabilem Kreislauf innerhalb weniger Minuten auf Ziel-BFR.</p>', why:'Marburg: Langsames Hochfahren erhöht das Clotting, weil die Filtrationsrate für kleine Blutflüsse zu hoch ist.'},
      {title:'Eindickung im Filter senken',
        custom:`<div class="derived"><div><small>Eindickung (Substituat + Entzug)</small><strong>${f0(d.ffPost)} %</strong> des Plasmaflusses</div><div><small>Hkt am Filterende</small><strong>≈ ${f0(d.hktEnd)} %</strong></div></div><p class="small muted">Berechnet mit Hkt ${f0(S.hkt)} % aus den Einstellungen. Eindickung = (Substituat + Netto-Entzug) ÷ (Blutfluss × (1 − Hkt)).</p>`,
        why:'Das Substituat läuft in Postdilution: Dieses Wasser wird dem Blut im Filter zusätzlich abgepresst. Je mehr abgepresst wird, desto zäher das Blut am Filterende. Das Citrat (PBP) verdünnt vor dem Filter und dickt kaum ein.',
        watch:`Hebel: Substituat oder Netto-Entzug senken, Blutfluss erhöhen. Faustregel: unter 20–25 % (Literatur 20–30 %); die Marburger Standardeinstellung liegt bei Hkt 30 % um 12 %. Die Citrat-PBP verdünnt vorher und zählt hier nicht mit.`}
    ];
    return stepsHTML(st);
  },
  after:`<div class="box"><h3>Sonst noch</h3><ul><li>Hoher Hämatokrit, Thrombozytose, Sepsis mit aktivierter Gerinnung verkürzen die Laufzeit.</li><li>Sets haben eine maximale Laufzeit laut Hersteller (in der Regel 72 h) – dann planmäßig wechseln.</li><li>Prädilution senkt laut S3-Leitlinie das Clotting, wenn das ein Problem ist – unter CiCa ist das Citrat bereits Prädilution.</li></ul></div>`
};

PG.dosis = {
  inputs:[],
  intro:`<p class="lead">Wie viel die CRRT entfernt, steuern zwei Wege: Diffusion über das Dialysat für kleine Moleküle, Konvektion über Citrat-PBP und Substituat für mittlere und größere.</p>`,
  out(){
    const d = D();
    let h = `<div class="derived"><div><small>Ablaufdosis</small><strong>${f0(d.effDose)}</strong> ml/kg/h</div><div><small>UF-Dosis (konvektiv)</small><strong>${f0(d.ufDose)}</strong> ml/kg/h</div><div><small>Ablauf gesamt</small><strong>${f0(d.eff)}</strong> ml/h</div><div><small>Gewicht</small><strong>${f0(S.kg)}</strong> kg <a class="small" href="#/einstellungen/gewicht">berechnen</a></div></div>`;
    h += `<div class="formula">Ablaufdosis = (PBP ${f0(d.pbp)} + Dialysat ${f0(S.dial)} + Substituat ${f0(S.sub)} + Entzug ${f0(S.net)}) ÷ ${f0(S.kg)} kg</div>`;
    h += `<div class="formula">UF-Dosis = (PBP + Substituat + Entzug) ÷ kg</div>`;
    h += `<p class="small">Marburg: Ablaufdosis 35 ml/kg/h bzw. UF-Dosis 20–25 ml/kg/h. S3-Leitlinie: 20–25 ml/kg/h über die geplante Behandlungsdauer, die tatsächlich gelaufene Dosis mindestens täglich dokumentieren. Pausen, Alarme und Filterwechsel senken die gelieferte Dosis – deshalb liegt die Verordnung meist darüber.</p>`;
    h += '<h3>Gewichtsadaptierte Tabelle (Marburg)</h3>' + marbTable(true);
    return h;
  },
  after:`<div class="box"><h3>Welcher Hebel für welches Ziel</h3><ul>
  <li><b>Kleine Moleküle</b> (Kreatinin, Harnstoff, K⁺, H⁺): Dialysat erhöhen.</li>
  <li><b>Mittel- bis großmolekular</b> (Myoglobin, Mediatoren): Konvektion erhöhen – Citrat-PBP und Substituat. High-Volume-Hämofiltration bei Sepsis empfiehlt die S3 nicht.</li>
  <li><b>Konvektion halten</b>, wenn Citrat oder Blutfluss gesenkt werden: Substituat erhöhen.</li>
  <li><b>Hohe Dosis</b> kostet Elektrolyte, Aminosäuren, Vitamine, Spurenelemente und ggf. Medikamente (Antiinfektiva!). Wieder reduzieren, sobald der Patient stabil ist.</li></ul></div>`
};

function marbRow(kg){
  let best = 0, bd = 1e9;
  MT.forEach((r, i) => { const dd = Math.abs(r[6] - kg); if(dd < bd){ bd = dd; best = i; } });
  return best;
}
const MT = [
  [80,800,800,400,40,24,50],[90,900,900,450,41,25,55],[100,1000,1000,500,42,25,60],[100,1000,1000,500,38,23,65],
  [110,1100,1100,550,39,24,70],[120,1200,1200,600,40,24,75],[130,1300,1300,650,41,24,80],[140,1400,1400,700,41,25,85],
  [150,1500,1500,750,42,25,90],[160,1600,1600,800,42,25,95],[160,1600,1600,800,40,24,100],[170,1700,1700,850,40,24,105],[180,1800,1800,900,41,25,110]
];
function marbTable(withBtn){
  const hi = marbRow(S.kg);
  let h = '<div class="tw"><table><thead><tr><th>KG Broca</th><th>BFR<br>ml/min</th><th>Citrat<br>mmol/L</th><th>PBP<br>ml/h</th><th>Dialysat<br>ml/h</th><th>Substituat<br>ml/h</th><th>Ablaufdosis<br>ml/kg/h</th><th>UF-Dosis<br>ml/kg/h</th></tr></thead><tbody>';
  MT.forEach((r, i) => { h += `<tr class="${i === hi ? 'hit' : ''}"><td>${r[6]} kg</td><td>${r[0]}</td><td>3,0</td><td>${f0(r[1])}</td><td>${f0(r[2])}</td><td>${f0(r[3])}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`; });
  h += '</tbody></table></div>';
  if(withBtn){
    const r = MT[hi];
    h += `<p class="small muted">Markiert: Zeile für ${f0(S.kg)} kg. Die Werte sind Orientierung und ans Therapieziel anzupassen (Filtration oder Dialyse).</p>`;
    h += applyBtn({bfr:r[0], cit:3.0, dial:r[2], sub:r[3]}, `Zeile ${r[6]} kg übernommen`).replace('Am Gerät umgestellt', 'Zeile als Ist-Einstellung übernehmen');
  }
  return h;
}

function naModel(na){
  const tbw = NA.f * S.kg, Q = Math.max(0.01, (D().eff - S.net) / 1000);
  return {tbw, Q, r0: Q * (140 - na) / tbw, d24: (140 - na) * (1 - Math.exp(-24 * Q / tbw))};
}
PG.natrium = {
  inputs:['na'],
  intro:`<p class="lead">Citratlösung und Phoxilium enthalten beide 140 mmol/L Natrium. Die CRRT zieht das Patienten-Na⁺ also Richtung 140 – bei einer Dysnatriämie oft schneller, als das Gehirn verträgt.</p>`,
  form(){
    return `<div class="fields"><div class="field"><label for="na_f">Körperwasser-Anteil</label><select id="na_f" data-na="f"><option value="0.6">0,6 junger Mann</option><option value="0.5">0,5 Frau, älterer Mann</option><option value="0.45">0,45 ältere Frau</option></select></div><div class="field"><label for="na_a">Verlauf</label><select id="na_a" data-na="akut"><option value="0">chronisch oder unklar</option><option value="1">akut, unter 48 h</option></select></div></div>`;
  },
  out(){
    const na = bval('na');
    if(na == null) return verdict('none', 'Na⁺ eintragen', '<br>Die App schätzt, wie schnell die CRRT das Natrium verschiebt.');
    if(na >= 135 && na <= 145) return verdict('ok', `${f0(na)} mmol/L – im Normbereich`, '<br>Die CRRT hält Na⁺ nahe 140.');
    const d = D(), M = naModel(na), hyper = na > 145, sg = x => (x > 0 ? '+' : '−') + f1(Math.abs(x));
    const limTxt = hyper ? (NA.akut ? 'akute Hypernatriämie: bis etwa 1 mmol/L pro Stunde' : 'chronisch: höchstens 10 mmol/L in 24 h') : 'höchstens 8 mmol/L in 24 h bei Risikopatienten, sonst bis 10';
    const tooFast = hyper ? (NA.akut ? Math.abs(M.r0) > 1.0 : Math.abs(M.d24) > 10) : M.d24 > 8;
    let h = verdict(tooFast ? 'bad' : 'warn', `${f0(na)} mmol/L – ${hyper ? 'Hypernatriämie' : 'Hyponatriämie'}`, `<br>Prognose ohne Gegenmaßnahme: <b>${sg(M.d24).replace(',0', '')} mmol/L in 24 h</b>, anfangs ${sg(M.r0)} pro Stunde. Grenze ${limTxt}.`);
    if(!tooFast){ h += note('Das Tempo liegt im Rahmen. Na⁺ trotzdem alle 2–4 h kontrollieren.'); }
    else if(hyper){
      const e = 1 - Math.exp(-24 * M.Q / M.tbw);
      const R = NA.akut ? M.Q * (na - 140) - M.tbw * 1.0 : M.Q * ((na - 10 / e) - 140);
      h += stepsHTML([{title:'Natrium über externen Perfusor zugeben',
        custom:`<div class="change"><span class="tag" style="--c:var(--eff)">NaCl 5,85 %</span> <span class="to">${f0(Math.max(0, R))} ml/h</span> <span class="muted small">(1 mmol/ml) – oder NaCl 10 % ${f1(Math.max(0, R)/1.71)} ml/h</span></div>`,
        why:'Marburg: Na⁺ kontrollieren und ggf. über eine externe Spritzenpumpe substituieren. Die Zugabe bremst den Abfall auf das erlaubte Tempo.',
        watch:'Na⁺ anfangs stündlich bis zweistündlich und die Rate nachführen – andere Na-Quellen (Infusionen, NaBic, Medikamente) zählen mit.'}]);
    } else {
      const qmax = -M.tbw / 24 * Math.log(1 - 8 / (140 - na)) * 1000;
      const room = qmax - d.pbp;
      h += stepsHTML([{title:'Clearance begrenzen oder hypoton gegensteuern',
        custom:`<p>Damit Na⁺ in 24 h nicht mehr als 8 mmol/L steigt, dürften Citrat-PBP, Dialysat und Substituat zusammen höchstens etwa <b>${f0(qmax)} ml/h</b> betragen (jetzt ${f0(M.Q*1000)} ml/h). ${room > 250 ? `Neben der Citrat-PBP (${f0(d.pbp)} ml/h) blieben ${f0(room)} ml/h für Dialysat und Substituat.` : `Schon die Citrat-PBP (${f0(d.pbp)} ml/h) allein liegt darüber – über die Dosis nicht lösbar.`}</p>`,
        why:'Jeder Liter, der im Filter ausgetauscht wird, bringt das Patienten-Na⁺ ein Stück Richtung 140. Weniger Austausch heißt langsamere Korrektur.',
        watch:'Reicht das nicht: hypotone Strategie (z. B. Glukose 5 % parallel oder angepasste Lösung) – mit Nephrologie oder Apotheke abstimmen. Na⁺ stündlich.'}]);
    }
    h += note(`Schätzung mit Gesamtkörperwasser ${f0(M.tbw)} L und Austausch ${f0(M.Q*1000)} ml/h (Ablauf ohne Netto-Entzug, der isoton entfernt). Nimmt vollständigen Ausgleich im Filter an und lässt Infusionen, Medikamente und Urin außen vor.`);
    return h;
  },
  after:`<div class="box"><h3>Warum das Tempo zählt</h3><p>Fällt eine chronische Hypernatriämie zu schnell, droht ein Hirnödem. Steigt eine chronische Hyponatriämie zu schnell, droht ein osmotisches Demyelinisierungssyndrom (ODS, früher ZPM). Marburg warnt vor allem bei Hypernatriämie vor raschem Na-Abfall.</p></div>`
};

PG.kalium = {
  inputs:['k','be'],
  intro:`<p class="lead">Phoxilium enthält 4 mmol/L K⁺. Die CRRT zieht das Patienten-K⁺ Richtung 4 – Hyperkaliämie wird abgebaut, Defizite aus anderen Verlusten aber nicht vollständig ersetzt.</p>`,
  out(){
    const k = bval('k');
    if(k == null) return verdict('none', 'K⁺ eintragen', '');
    if(k >= 3.5 && k <= 5.0) return verdict('ok', `${f1(k)} mmol/L – im Ziel`, '');
    if(k < 3.5) return verdict('warn', `${f1(k)} mmol/L – Hypokaliämie`, '') + stepsHTML([{title:'Über externen Perfusor substituieren', custom:'<p>Nach Klinik-Schema über eine externe Spritzenpumpe (Marburg).</p>', why:'Die Lösung hält K⁺ bei etwa 4, gleicht aber keine Verluste über Magen, Urin, Insulin oder eine Verschiebung in die Zellen bei Alkalose aus.', watch:'Bei Pause oder Stopp der CRRT läuft der Perfusor weiter, obwohl der Verlust wegfällt.'}]);
    const to = k >= 6.0 ? 2000 : Math.min(2000, S.dial + 500);
    const be = bval('be');
    return verdict(k >= 6.0 ? 'bad' : 'warn', `${f1(k)} mmol/L – Hyperkaliämie`, '') + stepsHTML([{title:'Dialysat erhöhen', k:'dial', to, blocked: S.dial >= 2000 ? 'Dialysat schon bei 2.000 ml/h.' : null,
      why:'K⁺ ist ein kleines Molekül und wird am wirksamsten per Diffusion entfernt. Die S3-Leitlinie empfiehlt bei lebensbedrohlicher Hyperkaliämie ein diffusives Verfahren mit hohem Dialysatfluss.',
      watch:'Mehr Dialysat entfernt auch mehr Citrat – Tendenz zur Azidose, und Azidose treibt K⁺ aus den Zellen.' + (be != null && be < -2.5 ? ' Bei bestehender Azidose den Puffer über NaBic geben, nicht über weniger Dialysat.' : '') + ' Akutmaßnahmen (Calcium, Insulin-Glukose, β₂-Mimetika) laufen parallel – die CRRT wirkt nicht sofort.'}])
      + note(`Schrittweite: +500 ml/h, ab K⁺ 6,0 gleich an die Obergrenze. ${EMZ}`, true);
  }
};

PG.magnesium = {
  inputs:['mgv'],
  intro:`<p class="lead">Citrat bindet nicht nur Calcium, sondern auch Magnesium. Mg-Citrat geht über das Effluent verloren; die 0,6 mmol/L im Phoxilium decken das nicht. Deshalb läuft Magnesium von Anfang an mit.</p>
  <div class="target"><span>Perfusor: 5 Amp. Mg 10 % auf 50 ml = <b>0,4 mmol/ml</b></span><span>Start <b>1 ml/h</b></span><span>Kontrolle <b>1–2× täglich</b></span></div>`,
  out(){
    const m = bval('mgv');
    let h = `<div class="derived"><div><small>Perfusor jetzt</small><strong>${f1(S.mg)}</strong> ml/h</div><div><small>entspricht</small><strong>${f1(S.mg*0.4)}</strong> mmol/h</div><div><small>pro Tag</small><strong>${f0(S.mg*0.4*24)}</strong> mmol</div></div>`;
    if(m == null) return h + verdict('none', 'Mg²⁺ eintragen', '');
    if(m >= 0.7 && m <= 1.1) return h + verdict('ok', `${f2(m)} mmol/L – im Normbereich`, '<br>Rate beibehalten.');
    const to = m < 0.7 ? r1(S.mg + 0.5) : Math.max(0, r1(S.mg - 0.5));
    h += verdict('warn', `${f2(m)} mmol/L – ${m < 0.7 ? 'zu niedrig' : 'zu hoch'}`, '');
    h += stepsHTML([{title: m < 0.7 ? 'Perfusor erhöhen' : 'Perfusor senken', k:'mg', to,
      why: m < 0.7 ? 'Der Verlust über das Effluent ist größer als die Zufuhr.' : 'Mehr Zufuhr als Verlust – zum Beispiel nach Dosisreduktion oder Pause.',
      watch:`Neu ${f1(to*0.4*24)} mmol pro Tag. Nächste Kontrolle mit dem Tageslabor.`}]);
    return h + note('Ziel 0,7–1,1 mmol/L und Schritte von 0,5 ml/h sind Orientierung. ' + EMZ, true);
  }
};

PG.phosphat = {
  inputs:['po4'],
  intro:`<p class="lead">Phoxilium enthält 1,2 mmol/L Phosphat und zieht den Patientenwert dorthin. Eine Hypophosphatämie unter CRRT ist trotzdem häufig – vor allem bei hoher Dosis und langer Laufzeit.</p>`,
  out(){
    const p = bval('po4');
    if(p == null) return verdict('none', 'Phosphat eintragen', '');
    if(p >= 0.8 && p <= 1.5) return verdict('ok', `${f2(p)} mmol/L – im Ziel`, '');
    if(p < 0.8){
      const to = Math.min(1500, S.sub + 250);
      return verdict('warn', `${f2(p)} mmol/L – Hypophosphatämie`, '') + stepsHTML([{title:'Substituat erhöhen', k:'sub', to, blocked: S.sub >= 1500 ? 'Obergrenze 1.500 ml/h erreicht.' : null,
        why:'Marburg: Phosphat über den Substituatfluss korrigieren. Das Substituat läuft in Postdilution direkt ins Blut und bringt 1,2 mmol Phosphat pro Liter; die gleiche Menge geht mit dem Patientenwert ins Effluent. Netto bleibt etwas hängen, solange der Patient unter 1,2 liegt.',
        watch:`Mehr Substituat erhöht Konvektion (UF-Dosis ${f0(D(withS({sub:to})).ufDose)} ml/kg/h) und Eindickung im Filter. Reicht das nicht oder liegt Phosphat unter 0,6: zusätzlich i.v. substituieren und Ernährung prüfen.`}])
        + note('Schritt +250 ml/h und die Schwelle 0,6 sind Orientierung. ' + EMZ, true);
    }
    return verdict('info', `${f2(p)} mmol/L – erhöht`, '<br>Zu Beginn bei Nierenversagen häufig und durch die Clearance selbst rückläufig (Gradient Richtung 1,2). Steigt Phosphat unter laufender Therapie, nennt die Fachinfo: Phoxilium-Rate reduzieren bzw. phosphatfreie Lösung erwägen.');
  }
};

PG.leber = {
  inputs:['lac','tca','ica'],
  form: KOAG,
  intro:`<p class="lead">Citrat braucht eine Leber, die es abbaut. Leberversagen ist kein Ausschluss, aber ein Grund, vorsichtiger zu starten und enger zu messen.</p>`,
  out(){
    const A = accum(); let h = '';
    if(A.level === 'bad') h += verdict('bad', 'Akkumulation wahrscheinlich', `<br>${A.reasons.join(', ')} – ${plink('akkumulation','Maßnahmen')}`);
    else if(A.ratio != null) h += verdict('ok', `Ratio ${f2(A.ratio)} – kein Akkumulationszeichen`, '');
    h += stepsHTML([
      {title:'Mit niedriger Citratdosis starten', k:'cit', to:2.0, blocked: S.cit <= 2.0 ? 'Citrat läuft schon mit 2,0 mmol/L oder weniger.' : null, why:'Marburg: Citratzufuhr so niedrig wie möglich, Start mit 2,0–2,5 mmol/L, dann nach Klinik und Verträglichkeit.', watch:'Postfilter-Ca²⁺ steigt. Bei eingeschränkter plasmatischer Gerinnung toleriert Marburg bis 0,6 mmol/L.'},
      {title:'Engmaschig messen', custom:'<p>Laktat-Trend, ionisiertes und Gesamt-Ca (Ratio) regelmäßig – S3-Leitlinie bei Schock und Leberversagen.</p>', why:'Akkumulation kündigt sich über steigende Ratio und steigenden Ca-Bedarf an, bevor die Azidose deutlich wird.'},
      {title:'Grenzen kennen', custom:'<p>Steigendes Laktat plus Ratio über 2,4: Citrat so weit wie möglich reduzieren, bei weiterer Verschlechterung beenden (Marburg).</p>'}
    ]);
    if(S.cit > 2.0) h += `<div class="row">${applyBtn({cit:2.5}, 'Citrat jetzt 2,5 mmol/L').replace('Am Gerät umgestellt', 'Alternativ 2,5 mmol/L übernehmen')}</div>`;
    return h;
  },
  after:`<div class="box"><h3>Die Quellen sind sich nicht ganz einig</h3><ul>
  <li><b>Marburg:</b> Ohne Akkumulationszeichen ist Citrat bei Leberversagen meist problemlos möglich.</li>
  <li><b>S3-Leitlinie (2025):</b> Schock und Leberversagen sind keine absolute Kontraindikation. Bei ausgeprägter, fortschreitender Laktatazidose mit Schock und schwerem Leberversagen Citrat möglichst vermeiden.</li>
  <li><b>Fachinfo Regiocit:</b> nennt schwere Leberfunktionsstörung und Schock mit Muskelhypoperfusion als Gegenanzeige – der Einsatz ist dann eine bewusste Abwägung.</li></ul></div>`
};

PG.pause = {
  inputs:[],
  intro:`<p class="lead">Steht die Maschine, stehen auch Citrat und der integrierte Ca²⁺-Ausgleich – beide hängen an den Pumpen. Was extern läuft, läuft weiter.</p>`,
  out(){
    return stepsHTML([
      {title:'Ca²⁺-Ausgleich', custom:'<p>Stoppt automatisch mit dem Gerät. Umgekehrt gilt: Läuft das Citrat, muss auch der Ausgleich laufen – eine leere oder gestoppte Ca-Spritze bei laufendem Citrat führt rasch zu schwerer Hypokalzämie.</p>'},
      {title:'Externe Perfusoren', custom:`<p>Mg²⁺ (jetzt ${f1(S.mg)} ml/h) und K⁺ sind auf die CRRT-Verluste ausgelegt. Während der Pause pausieren oder reduzieren.</p>`, why:'Ohne Effluent gibt es keinen Verlust mehr – die Zufuhr läuft sonst ins Plus.'},
      {title:'Nach dem Stopp: Ca²⁺ kontrollieren', custom:'<p>Etwa nach 1 h eine BGA.</p>', why:'Es geht kein Calcium mehr verloren, und das restliche Citrat wird abgebaut und gibt gebundenes Calcium frei.'},
      {title:'Medikamente prüfen', custom:'<p>Dosierungen, die auf die CRRT-Clearance ausgelegt sind (vor allem Antiinfektiva), an die Nierenfunktion ohne CRRT anpassen.</p>'},
      {title:'Neustart wie Therapiestart', custom:'<p>BFR 60 ml/min, bei stabilem Kreislauf zügig auf Ziel. Postfilter-Ca²⁺ nach 10 min, BGA nach 30 min.</p>'},
      {title:'Katheter', custom:'<p>Wenn nicht zeitnah weitergeht: blocken nach Hausstandard.</p>'}
    ]);
  }
};

/* ================= Ansichten ================= */
let cur = null; // aktuelle Ansicht mit out()

function viewHome(){
  const fresh = B._t ? new Date(B._t) : null;
  const groups = [...new Set(PROBS.map(p => p.g))];
  return `<div class="cols">
  <section class="hero" aria-labelledby="h-bga">
    <h1 id="h-bga">BGA</h1>
    <p class="muted">Werte eintragen – die App zeigt den nächsten Schritt nach Marburger Empfehlung. Leere Felder werden ignoriert.</p>
    ${fieldsHTML(['ph','be','hco3','ica','pf','na','k','lac'])}
    <details class="more"${['tca','cl','alb','mgv','po4'].some(k => B[k] != null) ? ' open' : ''}><summary>Weitere Werte: Gesamt-Ca, Cl⁻, Albumin, Mg²⁺, Phosphat</summary>${fieldsHTML(['tca','cl','alb','mgv','po4'])}</details>
    <div class="row" style="margin-bottom:10px"><button class="btn sm ghost" type="button" id="clearB">Werte leeren</button><span class="small muted" id="bTime">${fresh ? 'Eingegeben ' + fresh.toLocaleString('de-DE', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : ''}</span></div>
    <div id="out" class="out"></div>
  </section>
  <section class="groups" aria-label="Probleme">
    ${groups.map(g => `<div class="group"><h2>${g}</h2><ul class="plist">${PROBS.filter(p => p.g === g).map(p => `<li><a href="#/p/${p.id}" style="--c:${p.c}"><div><b>${p.t}</b><span>${p.d}</span></div></a></li>`).join('')}</ul></div>`).join('')}
    <p class="small muted">Randfarbe = wichtigster Hebel, in der Leitungsfarbe am Gerät.</p>
  </section></div>`;
}

function homeOut(){
  const items = [], okList = [];
  const A = accum(), a = abState(), pf = bval('pf'), ica = bval('ica');
  const anything = Object.keys(BF).some(k => bval(k) != null);
  if(!anything) return '';
  if(A.level === 'bad') items.push({lvl:'bad', t:'Citratakkumulation wahrscheinlich', a:`${A.reasons.join(', ')}. Citrat nicht erhöhen, auf 1,5–2,0 mmol/L senken, ggf. Blutfluss senken.`, p:'akkumulation'});
  else if(A.level === 'warn') items.push({lvl:'warn', t:'Hinweis auf Citratakkumulation', a:`${A.reasons.join(', ')}. Gesamt-Ca und Ratio klären – bis dahin kein zusätzliches Citrat, Dialysat nicht senken.`, p:'akkumulation'});
  if(ica != null){
    const {d} = caRule(ica);
    if(d === 0) okList.push('Ca²⁺ Patient');
    else items.push({lvl: Math.abs(d) >= 20 ? 'bad' : Math.abs(d) === 5 ? 'info' : 'warn', t:`Ca²⁺ Patient ${f2(ica)} – ${d === 5 ? 'knapp unter dem Ziel' : d === -5 ? 'obere Zielhälfte' : d > 0 ? 'zu niedrig' : 'zu hoch'}`, a:`${NAME.ca} ${f0(S.ca)} → <strong>${f0(Math.max(5, S.ca + d))} %</strong>${S.ca + d > 120 ? ' – über 120 %: an Akkumulation denken' : ''}`, p:'patientca'});
  }
  if(pf != null){
    const d = pfRule(pf);
    if(d === 0) okList.push('Ca²⁺ postfilter' + (pf > 0.35 ? ' (bis 0,6 toleriert)' : ''));
    else if(d > 0 && A.susp) items.push({lvl:'info', t:`Ca²⁺ postfilter ${f2(pf)}`, a:'Bei Akkumulationsverdacht bewusst tolerieren, Citrat nicht erhöhen.', p:'postfilter'});
    else {
      const lo = A.level === 'bad' ? 1.5 : 2.0, to = d > 0 ? Math.min(4.5, r1(S.cit + 0.5)) : Math.max(lo, r1(S.cit - 0.5));
      items.push({lvl:'warn', t:`Ca²⁺ postfilter ${f2(pf)} – ${d > 0 ? 'Kreislauf zu wenig antikoaguliert' : 'mehr Citrat als nötig'}`, a: to === S.cit ? `Citrat schon an der Grenze (${f1(S.cit)}) – Ursachen prüfen.` : `Citrat ${f1(S.cit)} → <strong>${f1(to)} mmol/L</strong>`, p:'postfilter'});
    }
  }
  const t = abText(a);
  if(t){
    if(t.lvl === 'ok') okList.push('Säure-Basen');
    else if(t.p){
      const st = (t.p === 'alkalose' ? stepsAlk() : stepsAzi()).find(s => !s.blocked);
      let act = st && st.k ? `${NAME[st.k]} ${fv(st.k, S[st.k])} → <strong>${fv(st.k, st.to)} ${UNIT[st.k]}</strong>` : st ? st.title : '';
      if(t.p === 'alkalose' && pf != null && pfRule(pf) < 0) act += ' (die Citratsenkung oben hilft zusätzlich)';
      if(t.p === 'azidose' && A.susp) act = 'Erst die Akkumulation klären; Puffer bei Bedarf über NaBic.';
      else if(t.p === 'azidose' && A.level === 'unk') act = 'Erst Gesamt-Ca bestimmen (Ratio). Ohne Akkumulation dann: ' + act;
      items.push({lvl:t.lvl, t:t.t + (a.be != null ? ` (BE ${a.be > 0 ? '+' : ''}${f1(a.be)})` : ''), a:act, p:t.p});
    } else items.push({lvl:'info', t:t.t, a:t.a});
  }
  const k = bval('k');
  if(k != null){ if(k < 3.5) items.push({lvl:'warn', t:`K⁺ ${f1(k)} – zu niedrig`, a:'Externer Perfusor nach Klinik-Schema.', p:'kalium'}); else if(k > 5.0) items.push({lvl: k >= 6 ? 'bad' : 'warn', t:`K⁺ ${f1(k)} – zu hoch`, a:'Dialysat erhöhen (Diffusion).', p:'kalium'}); else okList.push('K⁺'); }
  const na = bval('na');
  if(na != null){ if(na < 135 || na > 145){ const M = naModel(na); items.push({lvl:'warn', t:`Na⁺ ${f0(na)} – ${na > 145 ? 'Hypernatriämie' : 'Hyponatriämie'}`, a:`Die CRRT verschiebt Na⁺ geschätzt um ${M.d24 > 0 ? '+' : '−'}${f0(Math.abs(M.d24))} mmol/L in 24 h – Tempo prüfen.`, p:'natrium'}); } else okList.push('Na⁺'); }
  const lac = bval('lac');
  if(lac != null && lac >= 2) items.push({lvl: lac >= 4 ? 'warn' : 'info', t:`Laktat ${f1(lac)}`, a: lac >= 4 ? 'Ob Citrat noch abgebaut wird, ist fraglich – Ratio und Leber im Blick.' : 'Trend verfolgen; bei Leberversagen Ratio bestimmen.', p:'leber'});
  const m = bval('mgv'); if(m != null){ if(m < 0.7 || m > 1.1) items.push({lvl:'warn', t:`Mg²⁺ ${f2(m)}`, a:`Perfusor ${m < 0.7 ? 'erhöhen' : 'senken'}.`, p:'magnesium'}); else okList.push('Mg²⁺'); }
  const p = bval('po4'); if(p != null){ if(p < 0.8) items.push({lvl:'warn', t:`Phosphat ${f2(p)} – zu niedrig`, a:'Substituat erhöhen.', p:'phosphat'}); else if(p > 1.5) items.push({lvl:'info', t:`Phosphat ${f2(p)} – erhöht`, a:'Meist rückläufig unter CRRT.', p:'phosphat'}); else okList.push('Phosphat'); }
  combos().filter(c => c.lvl !== 'info').forEach(c => items.push({lvl:c.lvl, t:'Einstellung prüfen: ' + c.t, a:c.a, href:'#/einstellungen'}));
  const order = {bad:0, warn:1, info:2};
  items.sort((x, y) => order[x.lvl] - order[y.lvl]);
  let h = '<h2 style="margin-top:6px">Auswertung</h2><ul class="res">' + items.map(i => `<li class="${i.lvl}"><b>${i.t}</b>${i.a ? `<div class="act">${i.a}</div>` : ''}${i.p ? `<a class="more" href="#/p/${i.p}">Details und Warum</a>` : i.href ? `<a class="more" href="${i.href}">Zu den Einstellungen</a>` : ''}</li>`).join('');
  if(okList.length) h += `<li class="ok"><b>Im Ziel: ${okList.join(', ')}</b></li>`;
  h += '</ul>';
  if(items.some(i => i.lvl !== 'info')) h += '<p class="hint">Pro BGA möglichst nur einen Säure-Basen-Schritt. Postfilter-Ca²⁺ 10 min, BGA 1 h nach jeder Flussänderung.</p>';
  return h;
}

function viewProblem(id){
  const p = PROBS.find(x => x.id === id), pg = PG[id];
  if(!p || !pg) return '<p>Seite nicht gefunden. <a href="#/">Zur Übersicht</a></p>';
  const hasIn = pg.inputs && pg.inputs.length;
  return `<a class="back" href="#/">← Alle Probleme</a>
  <h1>${p.t}</h1>
  <div class="cols">
    <div>${pg.intro}${hasIn ? `<div class="box" style="padding-bottom:4px"><h3>Werte</h3>${fieldsHTML(pg.inputs)}${pg.form ? pg.form() : ''}<p class="small muted" style="margin-top:-4px">Werte werden mit der BGA-Auswertung geteilt.</p></div>` : (pg.form ? pg.form() : '')}<div id="out" class="out"></div></div>
    <div class="stick">${pg.after || ''}${aside()}</div>
  </div>`;
}
function aside(){
  const d = D();
  return `<div class="box"><h3>Ist-Einstellung</h3><p class="small">BFR ${f0(S.bfr)} ml/min, Citrat ${f1(S.cit)} mmol/L (PBP ${f0(d.pbp)} ml/h), Ca²⁺-Ausgleich ${f0(S.ca)} %, Dialysat ${f0(S.dial)}, Substituat ${f0(S.sub)}, Entzug ${f0(S.net)} ml/h. Ablaufdosis ${f0(d.effDose)} ml/kg/h bei ${f0(S.kg)} kg.</p><a class="btn sm ghost" href="#/einstellungen">Einstellung ändern</a></div>`;
}

const SF = [
  {k:'bfr', step:10, rng:'Empfohlen 100, möglich 100–180. Start mit 60, dann zügig auf Ziel.'},
  {k:'cit', step:0.5, rng:'Empfohlen 3,0, möglich 2,0–4,5. Bei Akkumulation bis 1,5.'},
  {k:'ca', step:5, rng:'Start 80 %, danach nach Patienten-Ca²⁺.'},
  {k:'dial', step:250, rng:'Empfohlen 1000, möglich 250–2000.'},
  {k:'sub', step:50, rng:'Empfohlen 500, möglich 200–1500. Postdilution.'},
  {k:'net', step:10, rng:'Volumenentzug pro Stunde.'},
  {k:'kg', step:1, rng:'Marburg rechnet mit Broca (Größe − 100) – oben berechnen.'},
  {k:'hkt', step:1, rng:'Nur für die Eindickung im Filter.'},
  {k:'mg', step:0.5, rng:'Mg 10 %, 5 Amp. auf 50 ml = 0,4 mmol/ml. Start 1 ml/h.'}
];
function setWarn(k, v){
  const m = MARB[k];
  if(m && (v < m[0] || v > m[1])) return k === 'cit' && v < 2 ? 'Unter 2,0 – nur bei Akkumulation.' : k === 'bfr' && v < 100 ? 'Unter 100 – Startphase oder Tabellenzeile für 50–55 kg.' : 'Außerhalb des Marburger Bereichs.';
  return '';
}
function viewSettings(){
  return `<h1>Einstellungen</h1>
  <p class="lead">Trag ein, was gerade am Gerät läuft. Alle Vorschläge rechnen von hier aus, und die Zeile oben zeigt es dauerhaft an.</p>
  ${weightBox()}
  <div class="set">${SF.map(f => `<div class="sf${f.k === 'cit' ? ' pbp' : ''}" style="--c:${COL[f.k]}"><label for="s_${f.k}">${NAME[f.k]}</label><div class="rng">${f.rng}</div>
    <div class="stp"><button type="button" data-step="${f.k}" data-dir="-1" aria-label="${NAME[f.k]} senken">−</button><input id="s_${f.k}" data-s="${f.k}" inputmode="decimal" value="${fv(f.k, S[f.k]).replace(/\./g, '')}"><button type="button" data-step="${f.k}" data-dir="1" aria-label="${NAME[f.k]} erhöhen">+</button><span class="u">${UNIT[f.k]}</span></div>
    <div class="warnline" id="w_${f.k}">${setWarn(f.k, S[f.k])}</div></div>`).join('')}</div>
  <h2>Was daraus folgt</h2><div id="out" class="out"></div>
  <h2>Therapiestart nach Marburg</h2>
  <div class="cols even"><div class="box"><h3>Startwerte (Kurzanleitung)</h3>
    <div class="tw"><table><thead><tr><th>Einstellung</th><th>empfohlen</th><th>möglich</th></tr></thead><tbody>
    <tr><td>Blutfluss</td><td>100 ml/min</td><td>100–180</td></tr><tr><td>Citratdosis</td><td>3,0 mmol/L</td><td>2,0–4,5</td></tr><tr><td>Ca²⁺-Ausgleich</td><td>80 %</td><td></td></tr><tr><td>Dialysat</td><td>1000 ml/h</td><td>250–2000</td></tr><tr><td>Substituat</td><td>500 ml/h</td><td>200–1500</td></tr><tr><td>Magnesium</td><td>Mg 10 %, 1 ml/h</td><td></td></tr></tbody></table></div>
    ${applyBtn({bfr:100, cit:3.0, ca:80, dial:1000, sub:500, mg:1}, 'Marburger Startwerte gesetzt').replace('Am Gerät umgestellt', 'Startwerte übernehmen')}
    <p class="small muted" style="margin-top:10px">Ablauf: Start mit BFR 60 ml/min, bei stabilem Kreislauf innerhalb weniger Minuten auf Ziel-BFR. Langsames Steigern erhöht das Clotting-Risiko. (Im Original steht „60 ml/h“ – gemeint sind ml/min.)</p></div>
    <div class="box"><h3>Monitoring</h3><ul>
    <li><b>Postfilter-Ca²⁺:</b> 10 min nach Start und nach jeder Änderung der Flussraten</li>
    <li><b>BGA Patient:</b> 30 min nach Start und 1 h nach jeder Flussänderung – Ca²⁺, Na⁺, K⁺, pH, BE</li>
    <li><b>1–2× täglich:</b> Gesamt-Ca, Mg²⁺, Phosphat, ggf. Albumin</li></ul>
    <p class="small muted">Gilt für CVVHDF mit Prismocitrate 18/0 oder Regiocit und Phoxilium als Dialysat und Substituat in Postdilution, Set M100 (alternativ M60, ST60, ST100, M150, ST150, HF1000, HF1400, oXiris).</p></div></div>
  <h2>Gewichtsadaptierte Tabelle</h2>${marbTable(true)}`;
}
function weightBox(){
  return `<div class="box" id="gewicht"><h3>Körpergewicht berechnen</h3>
  <div class="row" style="align-items:flex-end;gap:12px"><div class="field" style="width:130px"><label for="w_groesse">Größe <span class="unit">cm</span></label><input id="w_groesse" data-w="groesse" inputmode="decimal" value="${S.groesse ? String(S.groesse).replace('.', ',') : ''}"></div>
  <div class="field" style="width:160px"><label for="w_sex">Geschlecht</label><select id="w_sex" data-w="sex"><option value="m"${S.sex !== 'w' ? ' selected' : ''}>männlich</option><option value="w"${S.sex === 'w' ? ' selected' : ''}>weiblich</option></select></div></div>
  <div id="wout">${weightOut()}</div></div>`;
}
function weightOut(){
  const g = S.groesse;
  if(!g || g < 120 || g > 230) return '<p class="small muted">Größe eintragen, dann rechnet die App beide Gewichte.</p>';
  const broca = Math.round(g - 100), ibw = Math.round((S.sex === 'w' ? 45.5 : 50) + 0.91 * (g - 152.4));
  const btn = (kg, lab) => `<button class="btn sm ghost" type="button" data-apply='{"kg":${kg}}' data-label="Gewicht jetzt ${kg} kg (${lab})"${S.kg === kg ? ' disabled' : ''}>${S.kg === kg ? 'Aktiv' : 'Übernehmen'}</button>`;
  return `<div class="derived"><div><small>Broca – für die Marburg-Tabelle</small><strong>${broca}</strong> kg<div class="apply">${btn(broca, 'Broca')}</div></div>
  <div><small>Ideales KG nach Devine</small><strong>${ibw}</strong> kg<div class="apply">${btn(ibw, 'Devine')}</div></div></div>
  <p class="small muted">Marburg rechnet die Dosis mit dem Gewicht nach Broca: Größe − 100. Ideales Körpergewicht nach Devine (wie das Sollgewicht der Beatmung): Männer 50 + 0,91 × (Größe − 152,4), Frauen 45,5 + 0,91 × (Größe − 152,4).</p>`;
}
function settingsOut(){
  const d = D();
  return `<div class="derived"><div><small>PBP (Citrat)</small><strong>${f0(d.pbp)}</strong> ml/h</div><div><small>Citratzufuhr</small><strong>${f1(d.citH)}</strong> mmol/h</div><div><small>Ablauf gesamt</small><strong>${f0(d.eff)}</strong> ml/h</div><div><small>Ablaufdosis</small><strong>${f0(d.effDose)}</strong> ml/kg/h</div><div><small>UF-Dosis</small><strong>${f0(d.ufDose)}</strong> ml/kg/h</div><div><small>Eindickung im Filter</small><strong>${f0(d.ffPost)}</strong> %</div></div>${combosHTML()}
  <p class="small muted">PBP = Citratdosis × BFR × 60 ÷ 18 (Prismocitrate 18 mmol/L). Das Gerät koppelt die PBP an den Blutfluss.</p>`;
}

function viewWissen(){
  const d = D();
  return `<h1>So funktioniert CiCa</h1>
  <p class="lead">Regionale Citratantikoagulation: Citrat macht nur den Kreislauf ungerinnbar, der Patient bekommt das Calcium zurück und das Citrat als Puffer. Fast jede Einstellungsfrage folgt aus diesem Kreislauf.</p>
  <div class="diagram">${diagram(d)}</div>
  <div class="cols even" style="margin-top:20px">
  <div class="box"><h3>Vier Sätze, aus denen alles folgt</h3><ol style="padding-left:20px;margin:0">
   <li>Citrat bindet Ca²⁺. Ohne freies Ca²⁺ keine Gerinnung im Kreislauf – Ziel postfilter 0,25–0,35 mmol/L.</li>
   <li>Ein großer Teil der Citrat-Calcium-Komplexe geht über das Effluent verloren. Dieses Calcium ersetzt der integrierte Ausgleich.</li>
   <li>Der Rest erreicht den Patienten: Leber und Muskel bauen Citrat ab, 1 mmol Citrat ergibt 3 mmol HCO₃⁻, das gebundene Ca²⁺ wird frei.</li>
   <li>Darum steuern Citratmenge (Dosis × Blutfluss) und Citratentfernung (vor allem Dialysat) den Säure-Basen-Haushalt.</li></ol></div>
  <div class="box"><h3>Formeln</h3>
   <div class="formula">PBP (ml/h) = Citratdosis × BFR × 60 ÷ 18</div>
   <div class="formula">Citratzufuhr (mmol/h) = Citratdosis × BFR × 60 ÷ 1000</div>
   <div class="formula">Ablaufdosis = (PBP + Dialysat + Substituat + Entzug) ÷ kg</div>
   <div class="formula">UF-Dosis = (PBP + Substituat + Entzug) ÷ kg</div>
   <div class="formula">Ratio = Gesamt-Ca ÷ ionisiertes Ca²⁺ (Akkumulation über 2,4)</div></div></div>
  <div class="box" style="margin-top:14px"><h3>Was zusammenpasst</h3><ul>
   <li><b>Marburg-Relation:</b> PBP = Dialysat = 10 × Blutfluss, Substituat = 5 × Blutfluss (ml/h je ml/min) – bei 100 ml/min also 1.000 / 1.000 / 500 ml/h. Die PBP koppelt das Gerät selbst.</li>
   <li><b>Dialysat zu Blutfluss</b> steuert den Säure-Basen-Haushalt: mehr Dialysat je Blut → mehr Citrat entfernt → Richtung Azidose; weniger → Richtung Alkalose. Abweichungen sind der gewollte Hebel, aber kein Dauerzustand.</li>
   <li><b>Substituat + Netto-Entzug zu Blutfluss</b> bestimmt die Eindickung im Filter: unter 20–25 % des Plasmaflusses halten, sonst clottet der Filter. Das ist die Kombination, die gefährlich werden kann.</li>
   <li><b>Dosis:</b> Ablaufdosis nicht unter 20 ml/kg/h (S3), konvektive Dosis nicht weit über 25 ml/kg/h (Marburg).</li></ul>
   <p class="small muted">Die App prüft diese Kombinationen bei jeder Einstellung und jedem Vorschlag. Grenzen außerhalb von Marburg und S3 (Eindickung, Dialysat-Relation) sind Orientierung.</p></div>
  <h2>Lösungen</h2>
  <div class="tw"><table><thead><tr><th>mmol/L</th><th>Citrat</th><th>Na⁺</th><th>Cl⁻</th><th>HCO₃⁻</th><th>K⁺</th><th>Ca²⁺</th><th>Mg²⁺</th><th>HPO₄²⁻</th></tr></thead><tbody>
  <tr><td>Prismocitrate 18/0 bzw. Regiocit (PBP)</td><td>18</td><td>140</td><td>86</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td></tr>
  <tr><td>Phoxilium (Dialysat und Substituat)</td><td>–</td><td>140</td><td>115,9</td><td>30</td><td>4</td><td>1,25</td><td>0,6</td><td>1,2</td></tr></tbody></table></div>
  <p class="small muted">Laut Fachinformation. Calcium wird als Ca-Gluconat 10 % (0,23 mmol/ml) zugeführt; es enthält weniger Ionen als Ca-Chlorid. Ca-Chlorid nur über ZVK.</p>`;
}

function diagram(d){
  const t = (x, y, s, o) => `<text x="${x}" y="${y}" ${o || ''}>${s}</text>`;
  return `<svg viewBox="0 0 820 366" role="img" aria-label="Schema des CiCa-Kreislaufs: Citrat vor der Blutpumpe, Filter mit Dialysat und Effluent, Substituat in Postdilution, Calciumausgleich vor der Rückgabe">
  <style>text{font-family:var(--font);font-size:13px;fill:#13303A}.b{font-weight:700;font-size:14px}.m{fill:#4B6670;font-size:12.5px}</style>
  <path d="M240 70 H600 V86 M600 240 V284 H262" fill="none" stroke="#F3E3A6" stroke-width="18" stroke-linejoin="round"/>
  <rect x="236" y="168" width="22" height="12" rx="3" fill="#F3E3A6"/>
  ${t(266,179,'Citratzone: Ca²⁺ gebunden,','class="m"')}
  ${t(266,195,'keine Gerinnung im Kreislauf','class="m"')}
  <path d="M144 140 H190 V70 H600 V86" fill="none" stroke="#A8232E" stroke-width="5" stroke-linejoin="round"/>
  <path d="M600 240 V284 H190 V196 H144" fill="none" stroke="#A8232E" stroke-width="5" stroke-linejoin="round"/>
  <path d="M300 64 l10 6 -10 6z M318 278 l-10 6 10 6z M600 258 l-6 -10 h12z" fill="#A8232E"/>
  <rect x="16" y="104" width="128" height="124" rx="12" fill="#F2F6F5" stroke="#13303A" stroke-width="2"/>
  ${t(80,132,'Patient','class="b" text-anchor="middle"')}
  ${t(80,160,'Leber, Muskel:','class="m" text-anchor="middle"')}
  ${t(80,178,'Citrat → 3 HCO₃⁻','text-anchor="middle"')}
  ${t(80,198,'Ca²⁺ wird frei','text-anchor="middle"')}
  <line x1="240" y1="42" x2="240" y2="70" stroke="#13303A" stroke-width="3"/>
  <rect x="212" y="8" width="56" height="34" rx="6" fill="#fff" stroke="#13303A" stroke-width="2"/>
  ${t(240,30,'Citrat','class="b" text-anchor="middle"')}
  ${t(278,22,'PBP vor der Blutpumpe','class="m"')}
  ${t(278,38,`${f1(S.cit)} mmol/L Blut = ${f0(d.pbp)} ml/h`)}
  <circle cx="400" cy="70" r="20" fill="#fff" stroke="#13303A" stroke-width="2"/>
  <path d="M400 56 v28 M386 70 h28" stroke="#13303A" stroke-width="2"/>
  ${t(400,108,'Blutpumpe','class="m" text-anchor="middle"')}
  ${t(400,124,`${f0(S.bfr)} ml/min`,'text-anchor="middle"')}
  <rect x="576" y="86" width="48" height="154" rx="10" fill="#fff" stroke="#13303A" stroke-width="2"/>
  <path d="M588 98 V228 M600 98 V228 M612 98 V228" stroke="#D3DFDD" stroke-width="2"/>
  ${t(566,150,'Filter','class="b" text-anchor="end"')}
  ${t(566,168,'Diffusion und','class="m" text-anchor="end"')}
  ${t(566,184,'Konvektion','class="m" text-anchor="end"')}
  <path d="M624 106 H660 V42 H700" fill="none" stroke="#C99A00" stroke-width="4" stroke-linejoin="round"/>
  <rect x="700" y="24" width="100" height="36" rx="6" fill="#FFF6D6" stroke="#C99A00" stroke-width="2"/>
  ${t(750,47,'Effluent','class="b" text-anchor="middle"')}
  ${t(750,80,'Ca-Citrat geht','class="m" text-anchor="middle"')}
  ${t(750,96,'hier verloren','class="m" text-anchor="middle"')}
  <path d="M700 282 H660 V224 H624" fill="none" stroke="#2C8A4E" stroke-width="4" stroke-linejoin="round"/>
  <rect x="700" y="264" width="100" height="36" rx="6" fill="#E6F3EB" stroke="#2C8A4E" stroke-width="2"/>
  ${t(750,287,'Dialysat','class="b" text-anchor="middle"')}
  ${t(750,320,'Phoxilium','class="m" text-anchor="middle"')}
  ${t(750,336,`${f0(S.dial)} ml/h`,'text-anchor="middle"')}
  <path d="M556 274 l10 10 -10 10 -10 -10z" fill="#fff" stroke="#13303A" stroke-width="2"/>
  ${t(556,264,'Postfilter-Ca²⁺','class="m" text-anchor="middle"')}
  ${t(556,314,'0,25–0,35','text-anchor="middle"')}
  <line x1="452" y1="284" x2="452" y2="304" stroke="#7546AC" stroke-width="4"/>
  <rect x="404" y="304" width="96" height="34" rx="6" fill="#EFE8F7" stroke="#7546AC" stroke-width="2"/>
  ${t(452,326,'Substituat','class="b" text-anchor="middle"')}
  ${t(452,356,'Postdilution','class="m" text-anchor="middle"')}
  <line x1="260" y1="284" x2="260" y2="306" stroke="#3A62A6" stroke-width="4"/>
  <rect x="226" y="306" width="68" height="22" rx="4" fill="#E8EEF8" stroke="#3A62A6" stroke-width="2"/>
  <path d="M294 317 h22 M316 309 v16" stroke="#3A62A6" stroke-width="3"/>
  ${t(260,346,`Ca²⁺-Ausgleich ${f0(S.ca)} %`,'text-anchor="middle"')}
  ${t(260,264,'Calcium zurück','class="m" text-anchor="middle"')}
  </svg>`;
}

const ABK = [
  ['AG','Anionenlücke (anion gap)'],['BE','Basenabweichung (base excess)'],['BFR','Blutfluss (blood flow rate)'],['BGA','Blutgasanalyse'],
  ['Ca²⁺','ionisiertes Calcium'],['CiCa','Citrat-Calcium-Antikoagulation'],['CRRT','kontinuierliche Nierenersatztherapie'],
  ['CVVHDF','kontinuierliche venovenöse Hämodiafiltration'],['Effluent','Ablauf: alles, was das Gerät abpumpt'],['FF','Filtrationsfraktion'],
  ['HCO₃⁻','Bikarbonat'],['Hkt','Hämatokrit'],['KG','Körpergewicht'],['NaBic','Natriumbikarbonat 8,4 % (1 mmol/ml)'],
  ['ODS','osmotisches Demyelinisierungssyndrom'],['PBP','Prä-Blutpumpe (hier: Citratlösung)'],['Postdilution','Substituat nach dem Filter'],
  ['Prädilution','Lösung vor dem Filter'],['Ratio','Gesamt-Ca ÷ ionisiertes Ca²⁺'],['S3','höchste Leitlinienstufe der AWMF'],
  ['TMP','Transmembrandruck'],['UF','Ultrafiltration'],['ZPM','zentrale pontine Myelinolyse'],['ZVK','zentraler Venenkatheter']
];
const SRC = [
  ['Arndt C, Vassiliou T: Marburger Therapieempfehlung für den Einsatz kontinuierlicher extrakorporaler Nierenersatzverfahren – Kurzanleitung Therapieführung mit Prismaflex oder Prismax und Allgemeine Informationen zur regionalen Citratantikoagulation. Philipps-Universität Marburg (Broschüre, Fotos der Seiten).', null],
  ['S3-Leitlinie Nierenersatztherapie in der Intensivmedizin, AWMF 040-017, 2025', 'https://register.awmf.org/assets/guidelines/040-017l_S3_Nierenersatztherapie-Intensivmedizin_2025-06.pdf'],
  ['Fachinformation Regiocit Hämofiltrationslösung', 'https://www.fachinfo.de/fi/detail/021325/regiocit-haemofiltrationsloesung'],
  ['Fachinformation Phoxilium (Baxter)', 'https://www.baxter.at/sites/g/files/ebysai1641/files/2019-05/fi-at_phoxilium.pdf'],
  ['Fresenius Medical Care: Ci-Ca Anpassungsringbuch (Mechanismus, Fehlmessungen)', 'https://freseniusmedicalcare.com/content/dam/fresenius-medical-care/austria/pdf/Anpassungsringbuch_Ci-Ca.pdf'],
  ['Studienprotokoll Prismocitrate 18, NCT02860130 (Akkumulationskriterien)', 'https://cdn.clinicaltrials.gov/large-docs/30/NCT02860130/Prot_000.pdf'],
  ['WA Country Health Service: Prismaflex CRRT using Citrate (Vorgehen bei Pause)', 'https://wacountry.health.wa.gov.au/~/media/WACHS/Documents/About-us/Policies/Use-of-Prismaflex-Continuous-Renal-Replacement-Therapy-using-Citrate-as-an-Anticoagulant-Procedure.pdf']
];
function viewAbk(){
  return `<h1>Abkürzungen und Quellen</h1>
  <div class="cols even"><div class="box"><h3>Abkürzungen</h3><div class="tw"><table><tbody>${ABK.map(a => `<tr><td><b>${a[0]}</b></td><td style="white-space:normal;text-align:left">${a[1]}</td></tr>`).join('')}</tbody></table></div></div>
  <div><div class="box"><h3>Quellen</h3><ol style="padding-left:20px;margin:0">${SRC.map(s => `<li style="margin:6px 0">${s[1] ? `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>` : s[0]}</li>`).join('')}</ol></div>
  <div class="box"><h3>Was woher kommt</h3><p class="small">Zielwerte, Schrittweiten und Tabellen stammen aus der Marburger Empfehlung. Erklärungen zum Mechanismus stützen sich auf Fachinformationen und S3-Leitlinie. Alles, was darüber hinausgeht, ist im Text als Praxis-Hinweis markiert.</p>
  <p class="small">Arbeitshilfe – ersetzt nicht die ärztliche Beurteilung, Hausstandards und Herstellerangaben.</p>
  <p class="small muted">Version ${VERSION} vom ${VDATE}. <span id="swState"></span></p></div></div></div>`;
}

/* ================= Gerätezeile ================= */
function renderStrip(flash){
  const d = D();
  const sc = (k, v, u, cls, href) => `<a class="scale ${cls || ''}${flash && flash.includes(k) ? ' flash' : ''}" style="--c:${COL[k] || 'var(--eff)'}" href="${href || '#/einstellungen'}"><small>${NAME[k] || k}</small><strong>${v}</strong><em>${u}</em></a>`;
  document.getElementById('strip').innerHTML =
    sc('bfr', f0(S.bfr), 'ml/min') + sc('cit', f1(S.cit), 'mmol/L', 'pbp') + sc('ca', f0(S.ca), '%') +
    sc('dial', f0(S.dial), 'ml/h') + sc('sub', f0(S.sub), 'ml/h') + sc('net', f0(S.net), 'ml/h') +
    `<a class="scale dose" style="--c:var(--eff)" href="#/p/dosis"><small>Ablaufdosis</small><strong>${f0(d.effDose)}</strong><em>ml/kg/h</em></a>`;
  const cb = combos().filter(c => c.lvl !== 'info'), el = document.getElementById('combo');
  if(el) el.innerHTML = cb.length ? `<a class="combo ${cb.some(c => c.lvl === 'bad') ? 'bad' : 'warn'}" href="#/einstellungen">Einstellung prüfen: ${cb.map(c => c.t).join('; ')}</a>` : '';
}

/* ================= Router ================= */
function route(){
  const h = location.hash || '#/';
  const v = document.getElementById('view');
  let nav = 'home';
  if(h.startsWith('#/p/')){ const id = h.slice(4); v.innerHTML = viewProblem(id); cur = PG[id] || null; nav = ''; }
  else if(h.startsWith('#/einstellungen')){ v.innerHTML = viewSettings(); cur = {out:settingsOut}; nav = 'einstellungen'; }
  else if(h === '#/wissen'){ v.innerHTML = viewWissen(); cur = null; nav = 'wissen'; }
  else if(h === '#/abk'){ v.innerHTML = viewAbk(); cur = null; nav = 'abk'; swInfo(); }
  else { v.innerHTML = viewHome(); cur = {out:homeOut}; }
  document.querySelectorAll('[data-nav]').forEach(a => { if(a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const sel = document.getElementById('na_f'); if(sel) sel.value = String(NA.f);
  const sa = document.getElementById('na_a'); if(sa) sa.value = NA.akut ? '1' : '0';
  updateOut();
  renderStrip();
  if(h === '#/einstellungen/gewicht'){ const g = document.getElementById('gewicht'); if(g) setTimeout(() => g.scrollIntoView({block:'center'}), 0); }
  else if(!route.first) window.scrollTo(0, 0);
  route.first = false;
}
route.first = true;
function updateOut(){ const o = document.getElementById('out'); if(o && cur && cur.out) o.innerHTML = cur.out(); }

/* ================= Ereignisse ================= */
let undoState = null, toastT = null;
function toast(msg, undo){
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastUndo').style.display = undo ? '' : 'none';
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 5000);
}
document.getElementById('toastUndo').addEventListener('click', () => {
  if(!undoState) return; Object.assign(S, undoState); undoState = null; saveS();
  document.getElementById('toast').classList.remove('on'); refreshSettingsInputs(); updateOut(); renderStrip(); toast('Rückgängig gemacht', false);
});
function refreshSettingsInputs(){
  document.querySelectorAll('[data-s]').forEach(i => { const k = i.dataset.s; i.value = fv(k, S[k]).replace(/\./g, ''); const w = document.getElementById('w_' + k); if(w) w.textContent = setWarn(k, S[k]); });
}

document.addEventListener('input', e => {
  const el = e.target;
  if(el.dataset.b){ const k = el.dataset.b, v = num(el.value); if(v == null) delete B[k]; else B[k] = v; B._t = Date.now(); saveB();
    const p = BF[k].p; el.style.borderColor = (v != null && (v < p[0] || v > p[1])) ? 'var(--bad)' : '';
    const bt = document.getElementById('bTime'); if(bt) bt.textContent = 'Eingegeben ' + new Date(B._t).toLocaleString('de-DE', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
    updateOut(); }
  else if(el.dataset.w){ const k = el.dataset.w; S[k] = k === 'sex' ? el.value : num(el.value); saveS(); const w = document.getElementById('wout'); if(w) w.innerHTML = weightOut(); }
  else if(el.dataset.s){ const k = el.dataset.s, v = num(DEC[k] ? el.value : el.value.replace(/\./g, '')); if(v != null){ const L = LIM[k]; if(v >= L[0] && v <= L[1]){ S[k] = v; saveS(); el.style.borderColor = ''; const w = document.getElementById('w_' + k); if(w) w.textContent = setWarn(k, v); updateOut(); renderStrip(); } else el.style.borderColor = 'var(--bad)'; } }
});
document.addEventListener('change', e => {
  const el = e.target;
  if(el.hasAttribute && el.hasAttribute('data-koag')){ S.koag = el.checked; saveS(); updateOut(); return; }
  if(el.dataset.w === 'sex'){ S.sex = el.value; saveS(); const w = document.getElementById('wout'); if(w) w.innerHTML = weightOut(); return; }
  if(el.dataset.na){ NA[el.dataset.na] = el.dataset.na === 'akut' ? el.value === '1' : parseFloat(el.value); store(NKEY, NA); updateOut(); }
});
document.addEventListener('click', e => {
  const st = e.target.closest('[data-step]');
  if(st){ const k = st.dataset.step, f = SF.find(x => x.k === k), L = LIM[k];
    let v = S[k] + f.step * parseInt(st.dataset.dir, 10); v = Math.round(v * 100) / 100; v = Math.min(L[1], Math.max(L[0], v));
    S[k] = v; saveS(); refreshSettingsInputs(); updateOut(); renderStrip([k]); return; }
  const ap = e.target.closest('[data-apply]');
  if(ap){ const obj = JSON.parse(ap.dataset.apply); undoState = {}; Object.keys(obj).forEach(k => undoState[k] = S[k]); Object.assign(S, obj); saveS();
    refreshSettingsInputs(); updateOut(); renderStrip(Object.keys(obj)); const w = document.getElementById('wout'); if(w) w.innerHTML = weightOut(); toast(ap.dataset.label, true); return; }
  if(e.target.id === 'clearB'){ Object.keys(B).forEach(k => delete B[k]); saveB(); route(); return; }
});
window.addEventListener('hashchange', route);

/* ================= Offline ================= */
function swInfo(){
  const el = document.getElementById('swState'); if(!el) return;
  el.textContent = navigator.serviceWorker && navigator.serviceWorker.controller ? 'Offline verfügbar.' : 'Offline-Speicher noch nicht aktiv.';
}
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
document.getElementById('foot').textContent = 'Arbeitshilfe nach Marburger Therapieempfehlung – ersetzt nicht die ärztliche Beurteilung, Hausstandards und Herstellerangaben.';
route();
