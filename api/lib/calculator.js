'use strict';
/* ============================================================================
   KCSL · Calculator Service
   Единственное место, где что-либо считается. Фронт не считает ничего.
   Контракт: KCSL_V8_CALCULATION_CONTRACT.xlsx
   Нехватка входных данных → NOT_CALCULABLE + missing_inputs. Никогда не ноль.
   ========================================================================== */

const BLOCKS = ["PRO_SPORT","PUBLIC_SPORT","EMPLOYEE_SPORT","TEAMBUILDING","LEARNING_DEVELOPMENT",
  "BENEFITS","HEALTH","FAMILIES_CHILDREN","RETIREES","INCLUSION_DISABILITY","CHARITY_VOLUNTEERING","ENVIRONMENT"];

const Y="YES", C="CONDITIONAL", N="NO";
/* BLOCK_APPLICABILITY — построчно из контракта */
const APPLICABILITY = {
  PRO_SPORT:            {programme_chain:N, sport_cycle:N, cost_per_regular:N, return_rate:N, second_measurement:N},
  PUBLIC_SPORT:         {programme_chain:N, sport_cycle:N, cost_per_regular:N, return_rate:N, second_measurement:N},
  EMPLOYEE_SPORT:       {programme_chain:Y, sport_cycle:Y, cost_per_regular:C, return_rate:C, second_measurement:Y},
  TEAMBUILDING:         {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  LEARNING_DEVELOPMENT: {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  BENEFITS:             {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  HEALTH:               {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  FAMILIES_CHILDREN:    {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  RETIREES:             {programme_chain:N, sport_cycle:N, cost_per_regular:N, return_rate:N, second_measurement:N},
  INCLUSION_DISABILITY: {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  CHARITY_VOLUNTEERING: {programme_chain:C, sport_cycle:N, cost_per_regular:C, return_rate:N, second_measurement:C},
  ENVIRONMENT:          {programme_chain:N, sport_cycle:N, cost_per_regular:N, return_rate:N, second_measurement:N}
};

/* null / "" / NaN / отрицательное — отсутствие данных, НЕ ноль */
function num(v){
  if(v===null || v===undefined || v==="") return null;
  const n = Number(v);
  if(!Number.isFinite(n) || n < 0) return null;
  return n;
}
const BLOCKED  = (missing, reason) => ({ readiness:"BLOCKED", value:null, missing_inputs:missing||[], reason:reason||null });
const READY    = (value, unit)     => ({ readiness:"READY", value, unit:unit||null, missing_inputs:[], reason:null });
const NOT_APPL = (reason)          => ({ readiness:"NOT_APPLICABLE", value:null, missing_inputs:[], reason:reason||null });

/* ---- INPUT_VALIDATION ---- */
function validateChain(i){
  const e=[];
  if(i.employees_total===null) e.push({field:"employees_total", rule:"integer>0; source/date required"});
  else if(i.employees_total<=0) e.push({field:"employees_total", rule:"must be > 0"});
  if(i.eligible!==null && i.employees_total!==null && i.eligible>i.employees_total) e.push({field:"eligible", rule:"eligible<=employees_total"});
  if(i.aware!==null && i.eligible!==null && i.aware>i.eligible)                     e.push({field:"aware", rule:"aware<=eligible"});
  if(i.first_use!==null && i.aware!==null && i.first_use>i.aware)                   e.push({field:"first_use", rule:"first_use<=aware"});
  if(i.regular!==null && i.first_use!==null && i.regular>i.first_use)               e.push({field:"regular", rule:"regular<=first_use"});
  return e;
}
function validateCycle(i){
  const e=[];
  if(i.started!==null && i.registered!==null && i.started>i.registered) e.push({field:"started", rule:"started<=registered"});
  if(i.finished!==null && i.started!==null && i.finished>i.started)     e.push({field:"finished", rule:"finished<=started"});
  if(i.returned!==null && i.finished!==null && i.returned>i.finished)   e.push({field:"returned", rule:"returned<=finished"});
  if(i.returned_first_time_users!==null && i.first_time_users!==null &&
     i.returned_first_time_users>i.first_time_users)                    e.push({field:"returned_first_time_users", rule:"<=first_time_users"});
  return e;
}

/* разрыв допустим только когда известны обе точки */
function gap(a,b,na,nb){
  if(a===null || b===null){
    const miss=[]; if(a===null) miss.push(na); if(b===null) miss.push(nb);
    return BLOCKED(miss);
  }
  return READY(a-b, "people");
}

/* ============================ ПРОГРАММНАЯ ЦЕПОЧКА ======================== */
function programmeChain(block, ctx, raw){
  const ap = APPLICABILITY[block] || {};
  const out = { block, applicability:ap, errors:[], results:{} };

  const i = {
    employees_total:num(raw.employees_total), eligible:num(raw.eligible), aware:num(raw.aware),
    first_use:num(raw.first_use), regular:num(raw.regular), annual_budget:num(raw.annual_budget)
  };
  out.inputs = i;
  out.errors = validateChain(i);

  /* regular не принимается без заранее объявленного правила и окна */
  const regularAccepted = raw.regular_rule_declared ? i.regular : null;
  out.regular_rule_declared = !!raw.regular_rule_declared;

  const ctxMiss = [];
  if(!ctx.programme_id) ctxMiss.push("programme_id");
  if(!ctx.window)       ctxMiss.push("measurement_window");

  function guard(key){
    if(ap[key]===N) return NOT_APPL(`Calculation not applicable to block ${block} per BLOCK_APPLICABILITY.`);
    if(ap[key]===C && ctxMiss.length) return BLOCKED(ctxMiss.slice(), "Conditional applicability requires a defined employee programme.");
    if(ctxMiss.length) return BLOCKED(ctxMiss.slice());
    if(out.errors.length) return BLOCKED([], "Inputs failed validation.");
    return null;
  }

  const g = guard("programme_chain");
  if(g){
    ["eligible_not_aware","aware_not_started","started_not_regular","eligible_not_regular","largest_drop"]
      .forEach(k => out.results[k] = g);
  } else {
    const regName = raw.regular_rule_declared ? "regular" : "regular_rule_declared";
    out.results.eligible_not_aware   = gap(i.eligible, i.aware, "eligible", "aware");
    out.results.aware_not_started    = gap(i.aware, i.first_use, "aware", "first_use");
    out.results.started_not_regular  = gap(i.first_use, regularAccepted, "first_use", regName);
    out.results.eligible_not_regular = gap(i.eligible, regularAccepted, "eligible", regName);

    /* largest_drop = MAX первых трёх абсолютных разрывов */
    const three = [out.results.eligible_not_aware, out.results.aware_not_started, out.results.started_not_regular];
    const ready = three.filter(r => r.readiness==="READY");
    if(ready.length < 3){
      const miss=[]; three.forEach(r => (r.missing_inputs||[]).forEach(m => { if(!miss.includes(m)) miss.push(m); }));
      out.results.largest_drop = BLOCKED(miss, "All three chain drops are required.");
    } else {
      const abs = ready.map(r => Math.abs(r.value));
      const max = Math.max(...abs);
      const names = ["eligible → aware","aware → first_use","first_use → regular"];
      out.results.largest_drop = READY(max, "people");
      out.results.largest_drop.where = names[abs.indexOf(max)];
    }
  }

  /* ---- cost_per_regular ---- */
  const cg = guard("cost_per_regular");
  if(cg){ out.results.cost_per_regular = cg; }
  else if(raw.budget_source !== "EMPLOYEE_PROGRAMME"){
    /* QA · PRO_PUBLIC_BUDGET_IN_EMPLOYEE_CALC = 0 */
    out.results.cost_per_regular = BLOCKED([],
      `Budget contour ${raw.budget_source} is not an employee-programme allocation. PRO / PUBLIC / general money is excluded.`);
  } else {
    const miss=[];
    if(i.annual_budget===null) miss.push("annual_budget");
    if(!raw.currency)          miss.push("currency");
    if(!raw.period)            miss.push("period");
    if(!ctx.programme_id)      miss.push("programme_id");
    if(regularAccepted===null) miss.push(raw.regular_rule_declared ? "regular" : "regular_rule_declared");
    else if(regularAccepted===0) miss.push("regular>0");           /* QA · DIVIDE_BY_ZERO = 0 */
    if(miss.length) out.results.cost_per_regular = BLOCKED(miss);
    else {
      const r = READY(i.annual_budget/regularAccepted, raw.currency);
      r.period = raw.period;
      out.results.cost_per_regular = r;
    }
  }
  return out;
}

/* ================================ ЦИКЛ СПОРТА ============================ */
function sportCycle(block, ctx, raw){
  const ap = APPLICABILITY[block] || {};
  const out = { block, applicability:ap, errors:[], results:{} };

  const i = {
    registered:num(raw.registered), started:num(raw.started), finished:num(raw.finished),
    returned:num(raw.returned), sustained_180_plus:num(raw.sustained_180_plus),
    first_time_users:num(raw.first_time_users), returned_first_time_users:num(raw.returned_first_time_users),
    m1:num(raw.m1), m2:num(raw.m2)
  };
  out.inputs = i;
  out.errors = validateCycle(i);

  const ctxMiss = [];
  if(!ctx.programme_id) ctxMiss.push("programme_id");
  if(!ctx.window)       ctxMiss.push("measurement_window");

  function guard(key){
    if(ap[key]===N) return NOT_APPL("Sport cycle applies to EMPLOYEE_SPORT only.");
    if(ap[key]===C && ctxMiss.length) return BLOCKED(ctxMiss.slice(), "Conditional applicability requires a defined programme.");
    if(ctxMiss.length) return BLOCKED(ctxMiss.slice());
    if(out.errors.length) return BLOCKED([], "Inputs failed validation.");
    return null;
  }

  /* return_rate = returned / finished, та же завершившая когорта + объявленное окно */
  const rg = guard("return_rate");
  if(rg) out.results.return_rate = rg;
  else {
    const miss=[];
    if(!raw.window_declared) miss.push("observation_window_declared");
    if(i.returned===null)    miss.push("returned");
    if(i.finished===null)    miss.push("finished");
    else if(i.finished===0)  miss.push("finished>0");
    out.results.return_rate = miss.length ? BLOCKED(miss) : READY(i.returned/i.finished, "ratio");
  }

  /* отдельная когорта первого опыта — не смешивается с return_rate */
  const fg = guard("return_rate");
  if(fg) out.results.first_experience_return_rate = fg;
  else {
    const miss=[];
    if(i.returned_first_time_users===null) miss.push("returned_first_time_users");
    if(i.first_time_users===null)          miss.push("first_time_users");
    else if(i.first_time_users===0)        miss.push("first_time_users>0");
    out.results.first_experience_return_rate = miss.length ? BLOCKED(miss) : READY(i.returned_first_time_users/i.first_time_users, "ratio");
  }

  /* QA · RETURN_AS_SUSTAINED = 0 — только собственный замер */
  const sg = guard("sport_cycle");
  out.results.sustained_180_plus = sg ? sg : (i.sustained_180_plus===null
    ? BLOCKED(["sustained_180_plus"], "Never inferred from returned: the 180+ rule needs its own measurement.")
    : READY(i.sustained_180_plus, "people"));

  /* второй замер: like-for-like, без причинности */
  const mg = guard("second_measurement");
  if(mg) out.results.second_measurement = mg;
  else {
    const miss=[];
    if(i.m1===null) miss.push("M1");
    if(i.m2===null) miss.push("M2");
    if(!raw.comparable) miss.push("comparable_cohort_and_window");
    out.results.second_measurement = miss.length ? BLOCKED(miss) : READY(i.m2-i.m1, "people");
    if(out.results.second_measurement.readiness==="READY")
      out.results.second_measurement.reason = "Comparable change. Causality is not asserted.";
  }
  return out;
}

/* сводная готовность калькуляторов для одной программы */
function readiness(programme, company){
  if(!programme) return { calculator_readiness:"NOT_APPLICABLE", missing_inputs:["programme_id"] };
  const ctx = { programme_id:programme.programme_id, window:programme.window };
  const b = programme.budget || {};
  const chain = programmeChain(programme.block, ctx, Object.assign({}, programme.chain, {
    employees_total: (programme.chain && programme.chain.employees_total) != null
      ? programme.chain.employees_total : (company ? company.employees_total : null),
    annual_budget:b.amount, currency:b.currency, period:b.period, budget_source:b.contour,
    regular_rule_declared:programme.regular_rule_declared
  }));
  const cyc = sportCycle(programme.block, ctx, programme.cycle || {});
  const all = Object.assign({}, chain.results, cyc.results);
  const blocked = Object.keys(all).filter(k => all[k].readiness === "BLOCKED");
  const missing = [];
  blocked.forEach(k => (all[k].missing_inputs||[]).forEach(m => { if(!missing.includes(m)) missing.push(m); }));
  const anyReady = Object.keys(all).some(k => all[k].readiness === "READY");
  return {
    calculator_readiness: anyReady ? (blocked.length ? "READY" : "READY") : "BLOCKED",
    missing_inputs: missing,
    chain, cycle: cyc
  };
}

module.exports = { BLOCKS, APPLICABILITY, programmeChain, sportCycle, readiness, num };
