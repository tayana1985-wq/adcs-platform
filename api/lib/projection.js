'use strict';
/* ============================================================================
   KCSL · Projection Service
   Порядок ворот строго такой: Verification → Coverage → Privacy/Methodology
   → Publicity (PD-04) → Projection. Приватность идёт ПЕРЕД публичностью:
   OPEN никогда не отменяет NOT_PUBLIC.
   V8-поля отдаются только при явном запросе версии 8 — V1.1 не ломается.
   ========================================================================== */
const calc = require('./calculator');

const BLOCKS = calc.BLOCKS;

/* ------------------------- ВОРОТА 1: ВЕРИФИКАЦИЯ ------------------------- */
/* Только эти статусы вообще могут стать публичным фактом.
   SOURCE_PENDING никогда не становится VERIFIED сам по себе. */
const PUBLISHABLE_EVIDENCE = new Set(["VERIFIED","PARTIAL"]);

function passesVerification(e){
  if(!PUBLISHABLE_EVIDENCE.has(e.evidence_status)) return false;
  if(e.duplicate_of) return false;                 /* дубликат не создаёт новое событие */
  if(e.evidence_status === "VERIFIED" && !e.source_url) return false; /* VERIFIED требует прямой трассы */
  return true;
}

/* ------------------------- ВОРОТА 2: ПОКРЫТИЕ ---------------------------- */
/* Численные правила SUFFICIENT / INSUFFICIENT — TO_DEFINE, поэтому покрытие
   берётся из решения ревью, а не выводится формулой. NO_VERIFIED_DATA ≠ 0. */
function coverageForBlock(evidence){
  if(!evidence.length) return "NO_VERIFIED_DATA";
  const order = ["SUFFICIENT","PARTIAL","INSUFFICIENT","NO_VERIFIED_DATA"];
  let best = "NO_VERIFIED_DATA";
  evidence.forEach(e => {
    if(order.indexOf(e.coverage_status) < order.indexOf(best)) best = e.coverage_status;
  });
  return best;
}

/* -------------- ВОРОТА 3: ПРИВАТНОСТЬ / МЕТОДОЛОГИЯ ---------------------- */
function passesPrivacy(e){
  return e.public_output_allowed === "YES" || e.public_output_allowed === "CONDITIONAL";
}

/* ------------------------- ВОРОТА 4: PD-04 ------------------------------- */
/* CLOSED — расчёты остаются в кабинете; PARTIAL — разрешённые поля;
   OPEN — все разрешённые поля, но только разрешённые. */
function publicityAllows(companyPublicity, e){
  if(!passesPrivacy(e)) return false;                      /* приватность выигрывает всегда */
  if(companyPublicity === "CLOSED") return false;
  if(companyPublicity === "PARTIAL") return e.public_output_allowed === "YES";
  return true;                                             /* OPEN */
}

/* --------------------------- СБОРКА ПРОЕКЦИИ ----------------------------- */
function projectEvidence(reg, company){
  return reg.evidence
    .filter(e => e.company_id === company.company_id)
    .filter(passesVerification)
    .filter(e => publicityAllows(company.publicity_level, e));
}

const STAGE_ORDER = ["NOT_APPLICABLE","DID","OPENED","CONFIRMED","MEASURED","STRENGTHENED"];
function highestStage(list){
  let best = "NOT_APPLICABLE";
  list.forEach(e => { if(STAGE_ORDER.indexOf(e.positive_stage) > STAGE_ORDER.indexOf(best)) best = e.positive_stage; });
  return best;
}

function blockMap(projected){
  const map = {};
  BLOCKS.forEach(b => {
    const ev = projected.filter(e => e.block === b);
    map[b] = {
      coverage_status: coverageForBlock(ev),
      positive_stage : highestStage(ev),
      sport_contour  : ev.length ? ev[0].sport_contour : "NOT_APPLICABLE",
      claim          : ev.length ? ev[0].claim : null,
      evidence_count : ev.length
    };
  });
  return map;
}

function companyCoverage(projected){
  if(!projected.length) return "NO_VERIFIED_DATA";
  return coverageForBlock(projected);
}

/* V8-поля добавляются ТОЛЬКО при version===8 */
function withV8(base, v8fields, version){
  return version === 8 ? Object.assign({}, base, v8fields) : base;
}

function nextRelease(reg){
  const last = reg.releases[reg.releases.length - 1];
  return last ? last.next_update_at || nextSlotAfter(last.at) : null;
}
/* PD-05: публичные релизы в 09:00 и 21:00 по Алматы (UTC+5) */
function nextSlotAfter(iso){
  const d = new Date(iso);
  const almatyHour = (d.getUTCHours() + 5) % 24;
  const add = almatyHour < 9 ? (9 - almatyHour) : (almatyHour < 21 ? (21 - almatyHour) : (24 - almatyHour + 9));
  return new Date(d.getTime() + add * 3600e3).toISOString();
}

function companyPassport(reg, company, version){
  const projected = projectEvidence(reg, company);
  const base = {
    company_id: company.company_id,
    name: company.name,
    country: company.country,
    industry: company.industry,
    employees_total: company.employees_total,          /* null остаётся null, не 0 */
    employees_source_date: company.employees_source_date,
    coverage_status: companyCoverage(projected),
    demo: !!company.demo
  };
  const programme = reg.programmes.find(p => p.company_id === company.company_id) || null;
  const rd = calc.readiness(programme, company);
  return withV8(base, {
    publicity_level: company.publicity_level,
    positive_stage : highestStage(projected),
    blocks         : blockMap(projected),
    calculator_readiness: company.publicity_level === "CLOSED" ? "BLOCKED" : rd.calculator_readiness,
    missing_inputs : company.publicity_level === "CLOSED" ? ["publicity_level=CLOSED"] : rd.missing_inputs,
    next_update_at : nextRelease(reg)
  }, version);
}

function companyList(reg, version){
  return reg.companies.map(c => {
    const projected = projectEvidence(reg, c);
    return withV8({
      company_id:c.company_id, name:c.name, country:c.country, industry:c.industry,
      coverage_status: companyCoverage(projected), demo: !!c.demo
    }, {
      publicity_level:c.publicity_level,
      positive_stage: highestStage(projected),
      next_update_at: nextRelease(reg)
    }, version);
  });
}

/* /live — фактическая публичная активность, без оценок и рангов */
function live(reg, version){
  const items = [];
  reg.companies.forEach(c => {
    projectEvidence(reg, c).forEach(e => {
      items.push(withV8({
        evidence_id:e.evidence_id, company_id:c.company_id, company:c.name,
        claim:e.claim, source_url:e.source_url, source_type:e.source_type, source_date:e.source_date,
        evidence_status:e.evidence_status
      }, {
        block:e.block, sport_contour:e.sport_contour, positive_stage:e.positive_stage,
        publicity_level:e.publicity_level,
        said:e.said, did:e.did, reached:e.reached, remained:e.remained
      }, version));
    });
  });
  items.sort((a,b) => String(b.source_date||"").localeCompare(String(a.source_date||"")));
  return { items, next_update_at: nextRelease(reg) };
}

/* /companies/{id}/sport — карта доказательств по контурам, НЕ таблица лиги */
function sportMap(reg, company, version){
  const projected = projectEvidence(reg, company);
  const byContour = { PRO:[], PUBLIC:[], EMPLOYEE:[], NOT_APPLICABLE:[] };
  projected.forEach(e => (byContour[e.sport_contour] || byContour.NOT_APPLICABLE).push({
    evidence_id:e.evidence_id, block:e.block, claim:e.claim,
    source_url:e.source_url, positive_stage:e.positive_stage
  }));
  const programme = reg.programmes.find(p => p.company_id === company.company_id) || null;
  const base = {
    company_id: company.company_id,
    contours: {
      PRO:      { evidence: byContour.PRO,      employee_funnel:"NOT_APPLICABLE" },
      PUBLIC:   { evidence: byContour.PUBLIC,   employee_funnel:"NOT_APPLICABLE" },
      EMPLOYEE: { evidence: byContour.EMPLOYEE, employee_funnel: programme ? "APPLICABLE" : "NOT_APPLICABLE" }
    },
    rule: "PRO / PUBLIC investment never becomes employee allocation."
  };
  if(version === 8 && programme && company.publicity_level !== "CLOSED"){
    base.participation = {
      programme_id: programme.programme_id,
      window: programme.window,
      chain: programme.chain,
      cycle: programme.cycle
    };
  }
  return base;
}

/* /core — FEATURE_GATED; score-поля всегда null */
function core(reg, company, enabled){
  return {
    company_id: company.company_id,
    feature_gate: enabled ? "ENABLED" : "DISABLED",
    core_score: null, rank: null, points: null, weight: null,
    note: "CORE score fields are null by contract. No approved score or threshold exists."
  };
}

/* /season/current — снимок Evidence Season; очки/форма/матчи/ранг закрыты гейтом */
function season(reg, version){
  const base = {
    season_id: "EVIDENCE-SEASON-2026",
    evidence_verified: reg.evidence.filter(e => e.evidence_status === "VERIFIED").length,
    companies: reg.companies.length,
    points: null, form: null, matches: null, rank: null,
    note: "Evidence Season is a coverage snapshot, not a league table."
  };
  return withV8(base, { next_update_at: nextRelease(reg) }, version);
}

module.exports = {
  BLOCKS, passesVerification, passesPrivacy, publicityAllows, coverageForBlock,
  projectEvidence, blockMap, highestStage, companyPassport, companyList,
  live, sportMap, core, season, nextRelease, nextSlotAfter, withV8
};
