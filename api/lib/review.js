'use strict';
/* ============================================================================
   KCSL · Backstage / Review
   Ревьюер меняет СТАТУС и КЛАССИФИКАЦИЮ, но никогда не редактирует факты
   источника (claim, source_url, source_type, source_date). Автоверификации
   не существует: VERIFIED ставится только вручную и только при прямой трассе.
   ========================================================================== */
const store = require('./store');
const proj  = require('./projection');
const calc  = require('./calculator');

/* поля, которые ревью не имеет права трогать ни при каком действии */
const IMMUTABLE_SOURCE_FACTS = ["claim","source_type","source_date","company_id","evidence_id","publication_id"];

const REVIEW_ACTIONS = ["ACCEPT_VERIFIED","ACCEPT_PARTIAL","SOURCE_PENDING","RECLASSIFY","DUPLICATE","REJECT"];

const QUEUES = {
  discovery:          { title:"Discovery",                 test:e => e.evidence_status === "SEARCH_INCOMPLETE" && e.existing_registry_match === "NO" },
  identity_dedup:     { title:"Identity / Dedup",           test:e => e.existing_registry_match === "POSSIBLE" && !e.duplicate_of },
  source_recovery:    { title:"Source Recovery",            test:e => !e.source_url && e.evidence_status !== "REJECTED" },
  evidence_review:    { title:"Evidence Review",            test:e => e.evidence_status === "PARTIAL" || e.evidence_status === "SEARCH_INCOMPLETE" },
  taxonomy_review:    { title:"Taxonomy Review",            test:e => !!e.taxonomy_flag },
  duplicate_attached: { title:"Duplicate Attachments",      test:e => !!e.duplicate_of },
  source_pending:     { title:"Source Resolution Pending",  test:e => e.evidence_status === "SOURCE_PENDING" },
  projection_ready:   { title:"Projection Ready",           test:e => proj.passesVerification(e) && proj.passesPrivacy(e) },
  blocked:            { title:"Blocked",                    test:e => e.public_output_allowed === "NO" && e.evidence_status !== "REJECTED" },
  published:          { title:"Published",                  test:(e,reg) => reg.releases.some(r => r.published && (r.evidence_ids||[]).includes(e.evidence_id)) }
};

function queueCounts(reg){
  const out = {};
  Object.keys(QUEUES).forEach(k => {
    out[k] = { title: QUEUES[k].title, count: reg.evidence.filter(e => QUEUES[k].test(e, reg)).length };
  });
  return out;
}

function queueItems(reg, name){
  const q = QUEUES[name];
  if(!q) return null;
  return reg.evidence.filter(e => q.test(e, reg)).map(e => {
    const company = reg.companies.find(c => c.company_id === e.company_id);
    const pub = e.publication_id ? reg.publications.find(p => p.publication_id === e.publication_id) : null;
    const src = pub ? reg.sources.find(s => s.source_id === pub.source_id) : null;
    return {
      evidence_id:e.evidence_id, company_id:e.company_id, company: company ? company.name : null,
      block:e.block, sport_contour:e.sport_contour, object_type:e.object_type,
      claim:e.claim, evidence_status:e.evidence_status, coverage_status:e.coverage_status,
      positive_stage:e.positive_stage, publicity_level:e.publicity_level,
      public_output_allowed:e.public_output_allowed,
      existing_registry_match:e.existing_registry_match, duplicate_of:e.duplicate_of,
      taxonomy_flag:!!e.taxonomy_flag,
      prohibited_inference:e.prohibited_inference,
      /* трасса источника — ревьюер видит, откуда взят факт, но не правит его */
      source_trace: {
        source_url:e.source_url, source_type:e.source_type, source_date:e.source_date,
        publication_id:e.publication_id,
        publication: pub ? { title:pub.title, url:pub.url, published_at:pub.published_at } : null,
        source: src ? { source_id:src.source_id, publisher:src.publisher, url:src.url } : null
      }
    };
  });
}

/* ------------------------------ ДЕЙСТВИЕ РЕВЬЮ --------------------------- */
function review(evidence_id, action, payload, operator){
  if(!REVIEW_ACTIONS.includes(action))
    return { ok:false, error:"UNKNOWN_ACTION", allowed:REVIEW_ACTIONS };

  /* попытка отредактировать факт источника отклоняется целиком */
  const illegal = Object.keys(payload||{}).filter(k => IMMUTABLE_SOURCE_FACTS.includes(k));
  if(illegal.length){
    /* попытка переписать факт источника — событие для журнала, даже
       если реестра она не достигла */
    store.log({ type:"SOURCE_FACT_EDIT_REFUSED", outcome:"REFUSED",
                refusal:"SOURCE_FACTS_ARE_IMMUTABLE",
                evidence_id, action, operator, fields:illegal });
    return { ok:false, error:"SOURCE_FACTS_ARE_IMMUTABLE", fields:illegal,
             note:"Review changes status and classification only. Source facts are never edited." };
  }

  return store.commit(reg => {
    const e = reg.evidence.find(x => x.evidence_id === evidence_id);
    if(!e) return { ok:false, error:"EVIDENCE_NOT_FOUND" };
    const before = { evidence_status:e.evidence_status, coverage_status:e.coverage_status,
                     block:e.block, sport_contour:e.sport_contour, duplicate_of:e.duplicate_of,
                     public_output_allowed:e.public_output_allowed };

    switch(action){
      case "ACCEPT_VERIFIED":
        /* QA · AUTO_VERIFIED = 0: без прямой ссылки VERIFIED не ставится */
        if(!e.source_url){
          return { ok:false, error:"DIRECT_SOURCE_REQUIRED",
                   note:"VERIFIED requires a direct source URL. Resolve the source first." };
        }
        e.evidence_status = "VERIFIED";
        e.coverage_status = payload.coverage_status || "SUFFICIENT";
        e.public_output_allowed = payload.public_output_allowed || "YES";
        break;

      case "ACCEPT_PARTIAL":
        e.evidence_status = "PARTIAL";
        e.coverage_status = payload.coverage_status || "PARTIAL";
        e.public_output_allowed = payload.public_output_allowed || "CONDITIONAL";
        break;

      case "SOURCE_PENDING":
        e.evidence_status = "SOURCE_PENDING";
        e.coverage_status = "NO_VERIFIED_DATA";   /* ≠ 0 */
        e.public_output_allowed = "NO";
        break;

      case "RECLASSIFY":
        if(payload.block){
          if(!calc.BLOCKS.includes(payload.block)) return { ok:false, error:"UNKNOWN_BLOCK" };
          e.block = payload.block;
        }
        if(payload.sport_contour){
          if(!["PRO","PUBLIC","EMPLOYEE","NOT_APPLICABLE"].includes(payload.sport_contour)){
            return { ok:false, error:"UNKNOWN_CONTOUR" };
          }
          e.sport_contour = payload.sport_contour;
        }
        e.taxonomy_flag = false;
        break;

      case "DUPLICATE":
        if(!payload.duplicate_of) return { ok:false, error:"DUPLICATE_OF_REQUIRED" };
        if(!reg.evidence.some(x => x.evidence_id === payload.duplicate_of))
          return { ok:false, error:"DUPLICATE_TARGET_NOT_FOUND" };
        /* QA · DUPLICATE_CREATED_NEW_EVENT = 0 — дубликат прикрепляется, событие не создаётся */
        e.duplicate_of = payload.duplicate_of;
        e.evidence_status = "DUPLICATE";
        e.existing_registry_match = "DUPLICATE";
        e.public_output_allowed = "NO";
        break;

      case "REJECT":
        /* QA · REJECTED_ENTERED_REGISTRY = 0 — остаётся помеченным и не проецируется */
        e.evidence_status = "REJECTED";
        e.coverage_status = "NO_VERIFIED_DATA";
        e.public_output_allowed = "NO";
        e.reject_reason = payload.reason || null;
        break;
    }

    e.reviewed_at = new Date().toISOString();
    e.reviewed_by = operator;
    return { ok:true, evidence_id, action, before, after:{
      evidence_status:e.evidence_status, coverage_status:e.coverage_status,
      block:e.block, sport_contour:e.sport_contour, duplicate_of:e.duplicate_of,
      public_output_allowed:e.public_output_allowed } };
  }, () => ({ type:"EVIDENCE_REVIEW", evidence_id, action, operator, payload: payload||{} }));
}

/* восстановление прямой ссылки — единственное поле трассы, которое ревью
   может ДОБАВИТЬ, когда его не было; перезапись существующего запрещена */
function resolveSource(evidence_id, source_url, operator){
  return store.commit(reg => {
    const e = reg.evidence.find(x => x.evidence_id === evidence_id);
    if(!e) return { ok:false, error:"EVIDENCE_NOT_FOUND" };
    if(e.source_url) return { ok:false, error:"SOURCE_URL_ALREADY_SET",
                              note:"An existing source fact is never overwritten." };
    if(!/^https?:\/\//i.test(source_url || "")) return { ok:false, error:"INVALID_URL",
                              note:"A direct source trace must be an http(s) URL." };
    e.source_url = source_url;
    /* статус не меняется: восстановление ссылки ≠ верификация */
    return { ok:true, evidence_id, source_url, evidence_status:e.evidence_status,
             note:"Source recovered. Verification is still a separate manual decision." };
  }, () => ({ type:"SOURCE_RESOLUTION", evidence_id, source_url, operator }));
}

/* смена публичности компании (PD-04) — всегда в аудит */
function setPublicity(company_id, level, operator, reason){
  if(!["OPEN","PARTIAL","CLOSED"].includes(level))
    return { ok:false, error:"UNKNOWN_PUBLICITY_LEVEL" };
  return store.commit(reg => {
    const c = reg.companies.find(x => x.company_id === company_id);
    if(!c) return { ok:false, error:"COMPANY_NOT_FOUND" };
    const before = c.publicity_level;
    c.publicity_level = level;
    return { ok:true, company_id, before, after:level,
             note:"OPEN never bypasses evidence-level NOT_PUBLIC." };
  }, () => ({ type:"PUBLICITY_CHANGE", company_id, level, operator, reason: reason||null }));
}

/* заявки компаний и присланные доказательства — только в очередь, без публикации */
function submitApplication(body){
  const s = store.staging();
  const rec = Object.assign({
    application_id: "APP-" + Date.now().toString(36),
    received_at: new Date().toISOString(),
    status: "IN_REVIEW",
    published: false,
    note: "Never auto-published. Review target: next release, within 12 hours."
  }, body);
  s.applications.unshift(rec);
  store.saveStaging(s);
  store.log({ type:"APPLICATION_RECEIVED", application_id:rec.application_id, company_name:body.company_name||null });
  return rec;
}
function submitEvidence(body){
  const s = store.staging();
  const rec = Object.assign({
    submission_id: "SUB-" + Date.now().toString(36),
    received_at: new Date().toISOString(),
    status: "IN_REVIEW",
    evidence_status: "SEARCH_INCOMPLETE",
    published: false,
    note: "Submission enters the review queue. It never becomes VERIFIED automatically."
  }, body);
  s.submissions.unshift(rec);
  store.saveStaging(s);
  store.log({ type:"EVIDENCE_SUBMISSION_RECEIVED", submission_id:rec.submission_id, company_id:body.company_id||null });
  return rec;
}

module.exports = { QUEUES, REVIEW_ACTIONS, IMMUTABLE_SOURCE_FACTS,
  queueCounts, queueItems, review, resolveSource, setPublicity,
  submitApplication, submitEvidence };
