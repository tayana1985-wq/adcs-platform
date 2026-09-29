'use strict';
/* ============================================================================
   KCSL API
   CURRENT: API Projection Contract V1.1 — базовая линия, ломать нельзя.
   PROPOSED: поля и эндпоинты V8 отдаются только при явном запросе версии 8.
   /core закрыт feature-gate, score-поля всегда null.
   Фронт не считает ничего: расчёт возвращает Calculator Service.
   ========================================================================== */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const store   = require('./lib/store');
const proj    = require('./lib/projection');
const calc    = require('./lib/calculator');
const review  = require('./lib/review');
const release = require('./lib/release');

const PORT            = Number(process.env.KCSL_PORT || 8787);
const CORE_ENABLED    = process.env.KCSL_CORE_ENABLED === '1';
const OPERATOR_TOKEN  = process.env.KCSL_OPERATOR_TOKEN || 'dev-operator';
const ROOT            = path.join(__dirname, '..');

const CURRENT_VERSION = '1.1';

/* ------------------------------ утилиты --------------------------------- */
function send(res, status, body, extraHeaders){
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-KCSL-API-Version, X-KCSL-Operator',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }, extraHeaders || {}));
  res.end(payload);
}
function envelope(req, data, extra){
  return Object.assign({
    api_version: CURRENT_VERSION,
    requested_version: apiVersion(req) === 8 ? '8 (PROPOSED)' : CURRENT_VERSION,
    v8_fields_included: apiVersion(req) === 8,
    front_calculation: false,
    data
  }, extra || {});
}
/* версия: ?version=8 или заголовок X-KCSL-API-Version: 8. По умолчанию V1.1 */
function apiVersion(req){
  const q = req._url.searchParams.get('version');
  const h = req.headers['x-kcsl-api-version'];
  const v = String(q || h || '1.1').trim();
  return (v === '8' || v === 'v8') ? 8 : 1.1;
}
function isOperator(req){
  return (req.headers['x-kcsl-operator'] || req._url.searchParams.get('operator_token')) === OPERATOR_TOKEN;
}
function operatorName(req){ return req.headers['x-kcsl-operator-name'] || 'operator'; }

function readBody(req){
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if(raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch(e){ reject(e); } });
    req.on('error', reject);
  });
}
function notFound(res, note){
  send(res, 404, { error:'NOT_FOUND', note: note || null });
}
/* эндпоинт V8 без запрошенной версии 8 — это не 404 "нет такого", а
   "предложен, но не канонизирован" */
function proposedGate(req, res){
  if(apiVersion(req) === 8) return false;
  send(res, 409, {
    error: 'PROPOSED_ENDPOINT',
    note: 'This endpoint is PROPOSED in V8 and is not part of CURRENT API V1.1. Request it with ?version=8.',
    api_version: CURRENT_VERSION
  });
  return true;
}

/* --------------------------- статические файлы --------------------------- */
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml',
               '.json':'application/json; charset=utf-8' };
function serveStatic(req, res, pathname){
  const rel = pathname === '/' ? '/kcsl.html' : pathname;
  const file = path.join(ROOT, rel.replace(/^\/+/, ''));
  if(!file.startsWith(ROOT)) return notFound(res);           /* без выхода за корень */
  fs.stat(file, (err, st) => {
    if(err || !st.isFile()) return notFound(res, 'Unknown route or file: ' + pathname);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                         'Cache-Control':'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

/* ================================ РОУТЕР ================================= */
const server = http.createServer(async (req, res) => {
  req._url = new URL(req.url, 'http://localhost');
  const p = req._url.pathname.replace(/\/+$/,'') || '/';
  const v = apiVersion(req);

  if(req.method === 'OPTIONS') return send(res, 204, {});

  /* браузер всегда просит favicon; отдаём пустой, чтобы не шуметь 404 в консоли */
  if(p === '/favicon.ico'){
    res.writeHead(204, { 'Cache-Control':'public, max-age=86400' });
    return res.end();
  }

  const reg = store.master();
  const company = (id) => reg.companies.find(c => c.company_id === id);
  const m = (re) => p.match(re);

  try {
    /* ---------------------- индекс контракта ------------------------- */
    if(p === '/api' || p === '/api/'){
      return send(res, 200, {
        api_version: CURRENT_VERSION,
        current: ['/live','/companies','/companies/{id}','/companies/{id}/events','/companies/{id}/sport',
                  '/companies/{id}/relationships','/companies/{id}/achievements','/companies/{id}/cases',
                  '/companies/{id}/core (FEATURE_GATED)','/sport','/cases','/season/current',
                  'POST /company-applications','POST /evidence-submissions'],
        proposed_v8: ['/companies/{id}/evidence','/companies/{id}/participation','/companies/{id}/calculators',
                      'POST /calculators/evaluate','/releases/current','/releases/{release_id}'],
        backstage: ['/backstage/queues','/backstage/queues/{name}','POST /backstage/evidence/{id}/review',
                    'POST /backstage/evidence/{id}/resolve-source','POST /backstage/companies/{id}/publicity',
                    '/backstage/release/readiness','POST /backstage/release/publish','/backstage/audit'],
        rules: {
          NO_VERIFIED_DATA: 'never 0',
          SOURCE_PENDING: 'never becomes VERIFIED automatically',
          OPEN: 'never bypasses NOT_PUBLIC / privacy',
          PRO_PUBLIC_MONEY: 'never becomes employee allocation',
          FRONT_CALCULATION: 'prohibited — all results come from Calculator Service',
          CORE: 'feature-gated; score fields null'
        }
      });
    }

    /* =================== CURRENT · API V1.1 ========================== */
    if(p === '/live')             return send(res, 200, envelope(req, proj.live(reg, v)));
    if(p === '/companies')        return send(res, 200, envelope(req, proj.companyList(reg, v)));
    if(p === '/sport'){
      return send(res, 200, envelope(req, {
        companies: reg.companies.map(c => proj.sportMap(reg, c, v)),
        note: 'Sport evidence map, not a league table.'
      }));
    }
    if(p === '/cases'){
      return send(res, 200, envelope(req, reg.cases.map(c => ({
        case_id:c.case_id, company_id:c.company_id, title:c.title,
        did:c.did, measured:c.measured, not_claimed:c.not_claimed,
        causality: 'NOT_ASSERTED'
      }))));
    }
    if(p === '/season/current')   return send(res, 200, envelope(req, proj.season(reg, v)));

    let mm;
    if((mm = m(/^\/companies\/([^/]+)$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      return send(res, 200, envelope(req, proj.companyPassport(reg, c, v)));
    }
    if((mm = m(/^\/companies\/([^/]+)\/events$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      const events = reg.events.filter(e => e.company_id === c.company_id).map(e => ({
        event_id:e.event_id, name:e.name, date:e.date, block:e.block, sport_contour:e.sport_contour,
        publications: (e.publication_ids||[]).map(pid => reg.publications.find(x => x.publication_id === pid) || null).filter(Boolean)
      }));
      return send(res, 200, envelope(req, { company_id:c.company_id, events,
        note:'Publication is not an event. Multiple publications may support one event.' }));
    }
    if((mm = m(/^\/companies\/([^/]+)\/sport$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      return send(res, 200, envelope(req, proj.sportMap(reg, c, v)));
    }
    if((mm = m(/^\/companies\/([^/]+)\/relationships$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      const rels = reg.relationships.filter(r => r.company_id === c.company_id).map(r => {
        const src = reg.sources.find(s => s.source_id === r.source_id) || null;
        return { relationship_id:r.relationship_id, counterparty_id:r.counterparty_id, type:r.type,
                 sport_contour:r.sport_contour, from:r.from, to:r.to, verified:r.verified,
                 source: src ? { source_id:src.source_id, url:src.url, source_type:src.source_type } : null };
      });
      return send(res, 200, envelope(req, { company_id:c.company_id, relationships:rels,
        note:'A relationship is not an employee benefit.' }));
    }
    if((mm = m(/^\/companies\/([^/]+)\/achievements$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      const a = reg.achievements.filter(x => x.company_id === c.company_id);
      return send(res, 200, envelope(req, {
        company_id:c.company_id,
        PRO:      a.filter(x => x.contour === 'PRO'),
        EMPLOYEE: a.filter(x => x.contour === 'EMPLOYEE'),
        note:'PRO and EMPLOYEE achievements are separated and never form an automatic CORE.'
      }));
    }
    if((mm = m(/^\/companies\/([^/]+)\/cases$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      return send(res, 200, envelope(req, reg.cases.filter(x => x.company_id === c.company_id)));
    }
    if((mm = m(/^\/companies\/([^/]+)\/core$/))){
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      return send(res, 200, envelope(req, proj.core(reg, c, CORE_ENABLED)));
    }

    /* =================== PROPOSED · V8 ============================== */
    if((mm = m(/^\/companies\/([^/]+)\/evidence$/))){
      if(proposedGate(req, res)) return;
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      const list = proj.projectEvidence(reg, c).map(e => ({
        evidence_id:e.evidence_id, block:e.block, sport_contour:e.sport_contour,
        object_type:e.object_type, claim:e.claim, positive_stage:e.positive_stage,
        evidence_status:e.evidence_status, coverage_status:e.coverage_status,
        publicity_level:e.publicity_level,
        said:e.said, did:e.did, reached:e.reached, remained:e.remained,
        source_url:e.source_url, source_type:e.source_type, source_date:e.source_date,
        prohibited_inference:e.prohibited_inference
      }));
      return send(res, 200, envelope(req, { company_id:c.company_id, evidence:list,
        note:'Only verification- and publicity-cleared evidence is projected.' }));
    }
    if((mm = m(/^\/companies\/([^/]+)\/participation$/))){
      if(proposedGate(req, res)) return;
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      if(c.publicity_level === 'CLOSED')
        return send(res, 200, envelope(req, { company_id:c.company_id, participation:null,
          publicity_level:'CLOSED', note:'PD-04 CLOSED keeps participation numbers in the Cabinet.' }));
      const pr = reg.programmes.find(x => x.company_id === c.company_id) || null;
      return send(res, 200, envelope(req, { company_id:c.company_id,
        participation: pr ? { programme_id:pr.programme_id, window:pr.window, cohort:pr.cohort,
                              chain:pr.chain, cycle:pr.cycle } : null,
        note: pr ? 'Employee contour only.' : 'No defined employee programme.' }));
    }
    if((mm = m(/^\/companies\/([^/]+)\/calculators$/))){
      if(proposedGate(req, res)) return;
      const c = company(mm[1]); if(!c) return notFound(res, 'Unknown company_id');
      if(c.publicity_level === 'CLOSED')
        return send(res, 200, envelope(req, { company_id:c.company_id,
          calculator_readiness:'BLOCKED', missing_inputs:['publicity_level=CLOSED'], results:null,
          note:'PD-04 CLOSED: calculations stay in the Cabinet.' }));
      const pr = reg.programmes.find(x => x.company_id === c.company_id) || null;
      const rd = calc.readiness(pr, c);
      return send(res, 200, envelope(req, {
        company_id:c.company_id, programme_id: pr ? pr.programme_id : null,
        calculator_readiness: rd.calculator_readiness, missing_inputs: rd.missing_inputs,
        applicability: pr ? calc.APPLICABILITY[pr.block] : null,
        results: pr ? { chain: rd.chain.results, cycle: rd.cycle.results } : null,
        note:'Computed by the Calculator Service. The front performs no calculation.'
      }));
    }
    /* Интерактивный калькулятор публичной страницы. Без него форма на фронте
       вынуждена считать сама, а это прямо запрещено каноном. */
    if(req.method === 'POST' && p === '/calculators/evaluate'){
      if(proposedGate(req, res)) return;
      const body = await readBody(req);
      const block = body.block;
      if(!calc.BLOCKS.includes(block))
        return send(res, 400, { error:'UNKNOWN_BLOCK', allowed:calc.BLOCKS });
      const ctx = { programme_id: body.programme_id || '', window: body.window || '' };
      const chain = calc.programmeChain(block, ctx, body.chain || {});
      const cycle = calc.sportCycle(block, ctx, body.cycle || {});
      return send(res, 200, envelope(req, {
        block,
        applicability: calc.APPLICABILITY[block],
        chain: { inputs:chain.inputs, errors:chain.errors, results:chain.results,
                 regular_rule_declared:chain.regular_rule_declared },
        cycle: { inputs:cycle.inputs, errors:cycle.errors, results:cycle.results },
        note:'Computed by the Calculator Service. The front renders this verbatim.'
      }));
    }

    if(p === '/releases/current'){
      if(proposedGate(req, res)) return;
      const cur = release.current(reg);
      return send(res, 200, envelope(req, cur || { note:'No published release yet.' }));
    }
    if((mm = m(/^\/releases\/([^/]+)$/))){
      if(proposedGate(req, res)) return;
      const r = release.byId(reg, mm[1]);
      if(!r) return notFound(res, 'Unknown release_id');
      return send(res, 200, envelope(req, r));
    }

    /* =================== POST · очереди заявок ====================== */
    if(req.method === 'POST' && p === '/company-applications'){
      const body = await readBody(req);
      if(!body.company_name) return send(res, 400, { error:'company_name_required' });
      const rec = review.submitApplication(body);
      return send(res, 202, envelope(req, rec, { published:false }));
    }
    if(req.method === 'POST' && p === '/evidence-submissions'){
      const body = await readBody(req);
      if(!body.claim) return send(res, 400, { error:'claim_required' });
      const rec = review.submitEvidence(body);
      return send(res, 202, envelope(req, rec, { published:false }));
    }

    /* ======================== BACKSTAGE ============================= */
    /* namespace со слэшем: иначе /backstage.html попадает под охрану
       оператора и страница Backstage никогда не отдаётся */
    if(p.startsWith('/backstage/')){
      if(!isOperator(req))
        return send(res, 401, { error:'OPERATOR_TOKEN_REQUIRED',
          note:'Send X-KCSL-Operator. Backstage is never public.' });

      if(p === '/backstage/queues')
        return send(res, 200, { queues: review.queueCounts(reg) });

      if((mm = m(/^\/backstage\/queues\/([^/]+)$/))){
        const items = review.queueItems(reg, mm[1]);
        if(!items) return notFound(res, 'Unknown queue');
        return send(res, 200, { queue:mm[1], title:review.QUEUES[mm[1]].title, count:items.length, items });
      }

      if(req.method === 'POST' && (mm = m(/^\/backstage\/evidence\/([^/]+)\/review$/))){
        const body = await readBody(req);
        const out = review.review(mm[1], body.action, body.payload || {}, operatorName(req));
        return send(res, out.ok ? 200 : 400, out);
      }
      if(req.method === 'POST' && (mm = m(/^\/backstage\/evidence\/([^/]+)\/resolve-source$/))){
        const body = await readBody(req);
        const out = review.resolveSource(mm[1], body.source_url, operatorName(req));
        return send(res, out.ok ? 200 : 400, out);
      }
      if(req.method === 'POST' && (mm = m(/^\/backstage\/companies\/([^/]+)\/publicity$/))){
        const body = await readBody(req);
        const out = review.setPublicity(mm[1], body.publicity_level, operatorName(req), body.reason);
        return send(res, out.ok ? 200 : 400, out);
      }
      if(p === '/backstage/release/readiness')
        return send(res, 200, release.readiness(reg));
      if(req.method === 'POST' && p === '/backstage/release/publish'){
        const body = await readBody(req);
        const out = release.publish(operatorName(req), body.note);
        return send(res, out.ok ? 200 : 409, out);
      }
      if(p === '/backstage/audit'){
        const limit = Number(req._url.searchParams.get('limit') || 100);
        return send(res, 200, { entries: store.audit().entries.slice(0, limit) });
      }
      if(p === '/backstage/staging')
        return send(res, 200, store.staging());
      if(p === '/backstage/companies')
        return send(res, 200, { companies: reg.companies });

      return notFound(res, 'Unknown backstage route');
    }

    /* --------------------- статика и всё остальное ------------------- */
    if(req.method === 'GET') return serveStatic(req, res, p);
    return notFound(res);

  } catch(err){
    send(res, 500, { error:'INTERNAL', message:String(err && err.message || err) });
  }
});

if(require.main === module){
  server.listen(PORT, () => {
    console.log(`KCSL API · http://localhost:${PORT}`);
    console.log(`  контракт      → http://localhost:${PORT}/api`);
    console.log(`  публичный сайт→ http://localhost:${PORT}/kcsl.html`);
    console.log(`  backstage     → http://localhost:${PORT}/backstage.html`);
    console.log(`  оператор      → X-KCSL-Operator: ${OPERATOR_TOKEN}`);
    console.log(`  /core         → ${CORE_ENABLED ? 'ENABLED' : 'FEATURE-GATED (выключен)'}`);
  });
}
module.exports = server;
