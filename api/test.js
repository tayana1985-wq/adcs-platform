'use strict';
/* ============================================================================
   KCSL · Контрактные тесты
   Проверяют не «страница открылась», а сами правила канона. Каждый тест
   назван контролем из QA-листа. Запуск: node api/test.js
   ========================================================================== */
const fs   = require('fs');
const path = require('path');
const http = require('http');

const DATA = path.join(__dirname, 'data');
['registry.json','staging.json','audit.json'].forEach(f => {
  try { fs.unlinkSync(path.join(DATA, f)); } catch(e){}
});

process.env.KCSL_PORT = process.env.KCSL_PORT || '8899';
const server = require('./server');
const PORT = Number(process.env.KCSL_PORT);
const OP = { 'X-KCSL-Operator':'dev-operator', 'Content-Type':'application/json' };

function req(method, p, body, headers){
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host:'127.0.0.1', port:PORT, path:p, method,
      headers: Object.assign(data ? {'Content-Type':'application/json'} : {}, headers||{}) },
      res => { let raw=''; res.on('data',c=>raw+=c);
               res.on('end',()=>{ try{ resolve({status:res.statusCode, body: raw?JSON.parse(raw):null}); }
                                  catch(e){ resolve({status:res.statusCode, body:raw}); } }); });
    r.on('error', reject);
    if(data) r.write(data);
    r.end();
  });
}

let pass=0, fail=0;
const failures=[];
function check(name, cond, detail){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  ✗ ' + name + (detail?' — '+detail:'')); }
}
function group(t){ console.log('\n' + t); }

(async () => {
  await new Promise(r => server.listen(PORT, r));

  group('API V1.1 · базовая линия не сломана');
  for(const u of ['/live','/companies','/companies/KZ-DEMO-01','/companies/KZ-DEMO-01/events',
                  '/companies/KZ-DEMO-01/sport','/companies/KZ-DEMO-01/relationships',
                  '/companies/KZ-DEMO-01/achievements','/companies/KZ-DEMO-01/cases',
                  '/companies/KZ-DEMO-01/core','/sport','/cases','/season/current']){
    const r = await req('GET', u);
    check('GET ' + u + ' → 200', r.status === 200, 'получено ' + r.status);
  }

  group('Версионирование · V8 отдаётся только по запросу');
  let r = await req('GET','/companies/KZ-DEMO-01');
  check('V1.1 не содержит positive_stage', !('positive_stage' in r.body.data));
  check('V1.1 не содержит publicity_level', !('publicity_level' in r.body.data));
  r = await req('GET','/companies/KZ-DEMO-01?version=8');
  check('version=8 отдаёт positive_stage', 'positive_stage' in r.body.data);
  check('version=8 отдаёт blocks (12)', Object.keys(r.body.data.blocks).length === 12);
  r = await req('GET','/companies/KZ-DEMO-01/calculators');
  check('PROPOSED-эндпоинт без version=8 → 409', r.status === 409 && r.body.error === 'PROPOSED_ENDPOINT');

  group('QA · UNAPPROVED_SCORE_OR_THRESHOLD = 0');
  r = await req('GET','/companies/KZ-DEMO-01/core');
  check('/core закрыт гейтом', r.body.data.feature_gate === 'DISABLED');
  check('/core score-поля null', r.body.data.core_score === null && r.body.data.rank === null);
  r = await req('GET','/season/current');
  check('season points/rank null', r.body.data.points === null && r.body.data.rank === null);

  group('QA · NO_DATA_AS_ZERO = 0');
  r = await req('GET','/companies/KZ-DEMO-03?version=8');
  check('employees_total остаётся null', r.body.data.employees_total === null);
  check('покрытие без данных ≠ 0', r.body.data.coverage_status === 'NO_VERIFIED_DATA');
  check('блок без доказательств не получает ноль',
        r.body.data.blocks.PRO_SPORT.coverage_status === 'NO_VERIFIED_DATA' &&
        r.body.data.blocks.PRO_SPORT.evidence_count === 0);

  group('QA · PRO_AS_EMPLOYEE / PUBLIC_AS_EMPLOYEE = 0');
  r = await req('GET','/companies/WD-DEMO-13/sport');
  check('PRO без воронки сотрудников', r.body.data.contours.PRO.employee_funnel === 'NOT_APPLICABLE');
  check('PUBLIC без воронки сотрудников', r.body.data.contours.PUBLIC.employee_funnel === 'NOT_APPLICABLE');

  group('QA · PRO_PUBLIC_BUDGET_AS_EMPLOYEE = 0');
  const calc = require('./lib/calculator');
  const cpr = calc.programmeChain('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {employees_total:240, eligible:240, aware:188, first_use:96, regular:41,
     annual_budget:7200000, currency:'KZT', period:'ANNUAL', budget_source:'PRO', regular_rule_declared:true});
  check('бюджет PRO не даёт cost_per_regular', cpr.results.cost_per_regular.readiness === 'BLOCKED');
  const cpr2 = calc.programmeChain('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {employees_total:240, eligible:240, aware:188, first_use:96, regular:41,
     annual_budget:7200000, currency:'KZT', period:'ANNUAL', budget_source:'EMPLOYEE_PROGRAMME', regular_rule_declared:true});
  check('бюджет программы даёт результат', cpr2.results.cost_per_regular.readiness === 'READY');

  group('QA · применимость блоков');
  const pro = calc.programmeChain('PRO_SPORT', {programme_id:'P', window:'W'},
    {employees_total:10, eligible:10, aware:5, first_use:3, regular:1, budget_source:'EMPLOYEE_PROGRAMME', regular_rule_declared:true});
  check('PRO_SPORT → NOT_APPLICABLE', pro.results.largest_drop.readiness === 'NOT_APPLICABLE');
  const cond = calc.programmeChain('HEALTH', {programme_id:'', window:''}, {employees_total:10, eligible:10, aware:5});
  check('CONDITIONAL без programme_id → BLOCKED',
        cond.results.eligible_not_aware.readiness === 'BLOCKED' &&
        cond.results.eligible_not_aware.missing_inputs.includes('programme_id'));

  group('QA · DIVIDE_BY_ZERO / MISSING_INPUT_CALCULATED = 0');
  const z = calc.programmeChain('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {employees_total:240, eligible:240, aware:188, first_use:96, regular:0,
     annual_budget:100, currency:'KZT', period:'ANNUAL', budget_source:'EMPLOYEE_PROGRAMME', regular_rule_declared:true});
  check('regular=0 не делит на ноль', z.results.cost_per_regular.readiness === 'BLOCKED' &&
        z.results.cost_per_regular.missing_inputs.includes('regular>0'));
  const miss = calc.programmeChain('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {employees_total:240, eligible:240, aware:188, first_use:96, regular:null,
     budget_source:'EMPLOYEE_PROGRAMME', regular_rule_declared:true});
  check('пустой regular → BLOCKED, а не 0', miss.results.started_not_regular.readiness === 'BLOCKED');

  group('QA · COMPLETION_AS_REGULAR / RETURN_AS_SUSTAINED = 0');
  const nr = calc.programmeChain('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {employees_total:240, eligible:240, aware:188, first_use:96, regular:41,
     budget_source:'EMPLOYEE_PROGRAMME', regular_rule_declared:false});
  check('regular без объявленного правила не принимается', nr.results.started_not_regular.readiness === 'BLOCKED');
  const cyc = calc.sportCycle('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {registered:120, started:98, finished:74, returned:39, sustained_180_plus:null, window_declared:true});
  check('sustained не выводится из returned', cyc.results.sustained_180_plus.readiness === 'BLOCKED');
  check('return_rate считается', cyc.results.return_rate.readiness === 'READY');
  const nw = calc.sportCycle('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {registered:120, started:98, finished:74, returned:39, window_declared:false});
  check('без объявленного окна return_rate блокируется', nw.results.return_rate.readiness === 'BLOCKED');

  group('QA · WRONG_COHORT — валидация границ');
  const bad = calc.programmeChain('EMPLOYEE_SPORT', {programme_id:'P', window:'W'},
    {employees_total:100, eligible:100, aware:999, first_use:5, regular:1,
     budget_source:'EMPLOYEE_PROGRAMME', regular_rule_declared:true});
  check('aware > eligible отлавливается', bad.errors.some(e => e.field === 'aware'));

  group('Ворота публикации · OPEN не отменяет NOT_PUBLIC');
  r = await req('GET','/companies/KZ-DEMO-01/evidence?version=8');
  const ids = r.body.data.evidence.map(e => e.evidence_id);
  check('public_output_allowed=NO не проецируется у OPEN-компании', !ids.includes('EV-10244'));
  r = await req('GET','/live');
  const live = r.body.data.items.map(i => i.evidence_id);
  check('SOURCE_PENDING не в /live', !live.includes('EV-10244'));
  check('REJECTED не в /live', !live.includes('EV-10249'));
  r = await req('GET','/companies/KZ-DEMO-03/calculators?version=8');
  check('PD-04 CLOSED блокирует расчёты', r.body.data.calculator_readiness === 'BLOCKED');

  group('Backstage · доступ и неизменяемость фактов');
  r = await req('GET','/backstage/queues');
  check('без токена → 401', r.status === 401);
  r = await req('GET','/backstage.html');
  check('страница Backstage отдаётся без токена', r.status === 200);
  r = await req('GET','/backstage/queues', null, OP);
  check('с токеном → 200 и 10 очередей', r.status === 200 && Object.keys(r.body.queues).length === 10);

  r = await req('POST','/backstage/evidence/EV-10243/review', {action:'ACCEPT_PARTIAL', payload:{claim:'подмена'}}, OP);
  check('правка claim отклонена', r.body.error === 'SOURCE_FACTS_ARE_IMMUTABLE');
  r = await req('POST','/backstage/evidence/EV-10243/review', {action:'ACCEPT_VERIFIED', payload:{source_date:'2020-01-01'}}, OP);
  check('правка source_date отклонена', r.body.error === 'SOURCE_FACTS_ARE_IMMUTABLE');

  group('QA · AUTO_VERIFIED = 0');
  r = await req('POST','/backstage/evidence/EV-10244/review', {action:'ACCEPT_VERIFIED', payload:{}}, OP);
  check('VERIFIED без прямой ссылки отклонён', r.body.error === 'DIRECT_SOURCE_REQUIRED');
  r = await req('POST','/backstage/evidence/EV-10244/resolve-source', {source_url:'не ссылка'}, OP);
  check('невалидный URL отклонён корректно, без 500', r.status === 400 && r.body.error === 'INVALID_URL');
  r = await req('POST','/backstage/evidence/EV-10244/resolve-source', {source_url:'https://example.kz/demo-01/pro'}, OP);
  check('ссылка восстановлена', r.body.ok === true);
  check('статус не стал VERIFIED сам', r.body.evidence_status === 'SOURCE_PENDING');
  r = await req('POST','/backstage/evidence/EV-10244/resolve-source', {source_url:'https://evil.example/'}, OP);
  check('перезапись существующей ссылки запрещена', r.body.error === 'SOURCE_URL_ALREADY_SET');

  group('QA · DUPLICATE_NEW_EVENT = 0 / REJECTED_PUBLIC = 0');
  const before = (await req('GET','/companies/KZ-DEMO-02/events')).body.data.events.length;
  r = await req('POST','/backstage/evidence/EV-10245/review', {action:'DUPLICATE', payload:{duplicate_of:'EV-10242'}}, OP);
  const after = (await req('GET','/companies/KZ-DEMO-02/events')).body.data.events.length;
  check('дубликат не создал событие', r.body.ok === true && before === after);
  r = await req('POST','/backstage/evidence/EV-10241/review', {action:'REJECT', payload:{reason:'тест'}}, OP);
  const live2 = (await req('GET','/live')).body.data.items.map(i => i.evidence_id);
  check('отклонённое исчезает из публичной проекции', !live2.includes('EV-10241'));

  group('Журнал аудита фиксирует исход');
  r = await req('GET','/backstage/audit?limit=100', null, OP);
  const ents = r.body.entries;
  check('есть записи APPLIED', ents.some(e => e.outcome === 'APPLIED'));
  check('есть записи REFUSED', ents.some(e => e.outcome === 'REFUSED'));
  check('отказ VERIFIED записан', ents.some(e => e.refusal === 'DIRECT_SOURCE_REQUIRED'));
  check('попытка правки факта источника записана', ents.some(e => e.type === 'SOURCE_FACT_EDIT_REFUSED'));
  check('нет записи ERROR', !ents.some(e => e.outcome === 'ERROR'),
        JSON.stringify(ents.filter(e => e.outcome === 'ERROR').slice(0,2)));

  group('Релизы · PD-05');
  r = await req('GET','/backstage/release/readiness', null, OP);
  check('слот 09:00 или 21:00', ['09:00','21:00'].includes(r.body.next_slot));
  check('есть слоты обнаружения KZ и мира', !!r.body.kz_slot && !!r.body.world_slot);
  r = await req('POST','/backstage/release/publish', {note:'тест'}, OP);
  const published = r.body.ok;
  check('релиз публикуется оператором', published === true);
  r = await req('POST','/backstage/release/publish', {}, OP);
  check('повторная публикация без материала отклонена', r.body.error === 'NOTHING_TO_PUBLISH');
  r = await req('GET','/backstage/audit?limit=20', null, OP);
  check('отказ публикации не записан как RELEASE_PUBLISHED',
        r.body.entries.some(e => e.type === 'RELEASE_PUBLISH_REFUSED' && e.outcome === 'REFUSED'));

  group('Заявки · никогда не публикуются сами');
  r = await req('POST','/company-applications', {company_name:'Тест'});
  check('заявка → 202 и IN_REVIEW', r.status === 202 && r.body.data.status === 'IN_REVIEW' && r.body.data.published === false);
  r = await req('POST','/evidence-submissions', {claim:'Тестовое утверждение', company_id:'KZ-DEMO-01'});
  check('присланное доказательство не VERIFIED', r.body.data.evidence_status === 'SEARCH_INCOMPLETE');

  console.log('\n' + '─'.repeat(64));
  console.log(`Пройдено: ${pass}   Провалено: ${fail}`);
  if(fail){ console.log('\nПровалы:'); failures.forEach(f => console.log('  · ' + f)); }
  console.log('─'.repeat(64));
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Сбой набора тестов:', e); process.exit(1); });
