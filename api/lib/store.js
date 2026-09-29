'use strict';
/* ============================================================================
   KCSL · Хранилище реестра
   Канон: Registry → governed Projection → API → Front. HTML не база данных.
   MASTER не меняется, пока изменение не утверждено в Review и не записано
   через commit(). Всякая запись проходит здесь и попадает в журнал аудита.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MASTER   = path.join(DATA_DIR, 'registry.json');
const STAGING  = path.join(DATA_DIR, 'staging.json');
const AUDIT    = path.join(DATA_DIR, 'audit.json');

function readJson(file, fallback){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e){ return fallback; }
}
/* запись через временный файл: частично записанный реестр недопустим */
function writeJson(file, data){
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function ensure(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive:true });
  if(!fs.existsSync(MASTER)){
    const seed = require('../data/registry.seed.js');
    writeJson(MASTER, seed);
  }
  if(!fs.existsSync(STAGING)) writeJson(STAGING, { evidence:[], applications:[], submissions:[] });
  if(!fs.existsSync(AUDIT))   writeJson(AUDIT, { entries:[] });
}

const store = {
  master(){  ensure(); return readJson(MASTER,  null); },
  staging(){ ensure(); return readJson(STAGING, { evidence:[], applications:[], submissions:[] }); },
  audit(){   ensure(); return readJson(AUDIT,   { entries:[] }); },

  /* MASTER меняется только отсюда и только с записью в аудит.
     auditEntry может быть функцией от результата — журнал обязан
     фиксировать исход, а не сам факт попытки. Отказ тоже событие. */
  commit(mutator, auditEntry){
    ensure();
    const m = readJson(MASTER, null);
    let result, thrown = null;
    try { result = mutator(m); }
    catch(err){ thrown = err; }
    /* при отказе мутатора MASTER не переписывается */
    const changed = !thrown && !(result && result.ok === false);
    if(changed) writeJson(MASTER, m);
    if(auditEntry){
      const entry = typeof auditEntry === 'function' ? auditEntry(result) : auditEntry;
      if(entry) store.log(Object.assign({
        outcome: thrown ? 'ERROR' : (changed ? 'APPLIED' : 'REFUSED'),
        refusal: (result && result.ok === false) ? result.error : null
      }, entry));
    }
    if(thrown) throw thrown;
    return result;
  },
  saveStaging(s){ ensure(); writeJson(STAGING, s); },

  log(entry){
    ensure();
    const a = readJson(AUDIT, { entries:[] });
    a.entries.unshift(Object.assign({
      audit_id: 'AUD-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7),
      at: new Date().toISOString()
    }, entry));
    if(a.entries.length > 5000) a.entries.length = 5000;
    writeJson(AUDIT, a);
  },

  paths: { DATA_DIR, MASTER, STAGING, AUDIT }
};

module.exports = store;
