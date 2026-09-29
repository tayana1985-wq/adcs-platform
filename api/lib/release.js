'use strict';
/* ============================================================================
   KCSL · Release
   PD-05: публичные релизы в 09:00 и 21:00 по Алматы. Мониторинг идёт
   непрерывно между релизами. Цель обнаружения каждого релиза: +1 компания
   Казахстана и +1 компания мира. Обнаружение ≠ верификация.
   ========================================================================== */
const store = require('./store');
const proj  = require('./projection');
const review= require('./review');

const TZ_OFFSET_H = 5;          /* Asia/Almaty, UTC+5, без перехода на летнее время */

function almatyParts(d){
  const shifted = new Date(d.getTime() + TZ_OFFSET_H * 3600e3);
  return { h: shifted.getUTCHours(), m: shifted.getUTCMinutes(), date: shifted.toISOString().slice(0,10) };
}
/* ближайший слот 09:00 / 21:00 по Алматы, строго в будущем */
function nextSlot(from){
  const now = from ? new Date(from) : new Date();
  const p = almatyParts(now);
  let addH;
  if(p.h < 9)       addH = 9 - p.h;
  else if(p.h < 21) addH = 21 - p.h;
  else              addH = 24 - p.h + 9;
  const base = new Date(now.getTime() + addH * 3600e3);
  base.setUTCMinutes(0, 0, 0);
  return base.toISOString();
}
function slotLabel(iso){ return almatyParts(new Date(iso)).h >= 21 ? "21:00" : "09:00"; }

/* готовность релиза — то, что видит оператор перед публикацией */
function readiness(reg){
  const counts = review.queueCounts(reg);
  const ready = reg.evidence.filter(e => proj.passesVerification(e) && proj.passesPrivacy(e));
  const staging = store.staging();

  const lastRelease = reg.releases[reg.releases.length - 1] || null;
  const publishedIds = new Set();
  reg.releases.filter(r => r.published).forEach(r => (r.evidence_ids||[]).forEach(id => publishedIds.add(id)));
  const newSinceLast = ready.filter(e => !publishedIds.has(e.evidence_id));

  /* слоты обнаружения: по одной новой компании KZ и мира на релиз */
  const kzNew    = reg.companies.filter(c => c.country === "KZ"    && !c.first_released_in);
  const worldNew = reg.companies.filter(c => c.country === "WORLD" && !c.first_released_in);

  return {
    next_release_at: nextSlot(),
    next_slot: slotLabel(nextSlot()),
    last_release: lastRelease ? { release_id:lastRelease.release_id, at:lastRelease.at, slot:lastRelease.slot } : null,
    kz_slot:    { target:1, candidates:kzNew.length,    filled: kzNew.length    > 0, candidate: kzNew[0]    ? kzNew[0].company_id    : null },
    world_slot: { target:1, candidates:worldNew.length, filled: worldNew.length > 0, candidate: worldNew[0] ? worldNew[0].company_id : null },
    applications: { in_review: staging.applications.filter(a => a.status === "IN_REVIEW").length,
                    submissions: staging.submissions.filter(s => s.status === "IN_REVIEW").length,
                    sla: "Review target: next release, within 12 hours. Never auto-published." },
    evidence_ready: newSinceLast.length,
    evidence_ready_ids: newSinceLast.map(e => e.evidence_id),
    blocked: counts.blocked.count,
    source_pending: counts.source_pending.count,
    projected: ready.length,
    published: publishedIds.size,
    can_publish: newSinceLast.length > 0,
    note: "Discovery is not verification. Nothing here is published until an operator publishes it."
  };
}

/* публикация релиза — снимок проекции, целиком в аудит */
function publish(operator, note){
  const result = store.commit(reg => {
    const r = readiness(reg);
    if(!r.can_publish) return { ok:false, error:"NOTHING_TO_PUBLISH", readiness:r };

    const at = new Date().toISOString();
    const release = {
      release_id: "REL-" + at.slice(0,10) + "-" + slotLabel(nextSlot()).replace(":",""),
      slot: slotLabel(nextSlot()),
      at,
      next_update_at: nextSlot(at),
      evidence_ids: r.evidence_ready_ids,
      kz_discovery: r.kz_slot.candidate,
      world_discovery: r.world_slot.candidate,
      published: true,
      published_by: operator,
      note: note || null
    };
    /* компании, впервые попавшие в релиз, фиксируют это — слот закрывается */
    [release.kz_discovery, release.world_discovery].filter(Boolean).forEach(cid => {
      const c = reg.companies.find(x => x.company_id === cid);
      if(c && !c.first_released_in) c.first_released_in = release.release_id;
    });
    reg.releases.push(release);
    return { ok:true, release };
  }, (r) => ({
    type: (r && r.ok) ? "RELEASE_PUBLISHED" : "RELEASE_PUBLISH_REFUSED",
    release_id: (r && r.ok) ? r.release.release_id : null,
    operator, note: note || null
  }));

  if(result && result.ok) store.log({ type:"RELEASE_CONTENTS", release_id:result.release.release_id,
                                      evidence_ids:result.release.evidence_ids });
  return result;
}

function current(reg){
  const last = reg.releases.filter(r => r.published).slice(-1)[0] || null;
  if(!last) return null;
  return Object.assign({}, last, { next_update_at: last.next_update_at || nextSlot(last.at) });
}
function byId(reg, id){ return reg.releases.find(r => r.release_id === id) || null; }

module.exports = { nextSlot, slotLabel, readiness, publish, current, byId, TZ_OFFSET_H };
