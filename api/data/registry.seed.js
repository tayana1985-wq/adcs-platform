'use strict';
/* ============================================================================
   Демо-реестр KCSL. Сущности по KCSL_V8_DATA_CONTRACT · ENTITY_MODEL.
   Компании помечены demo:true — ни одно утверждение здесь не приписано
   реальной организации.
   ========================================================================== */
const BLOCKS = ["PRO_SPORT","PUBLIC_SPORT","EMPLOYEE_SPORT","TEAMBUILDING","LEARNING_DEVELOPMENT",
  "BENEFITS","HEALTH","FAMILIES_CHILDREN","RETIREES","INCLUSION_DISABILITY","CHARITY_VOLUNTEERING","ENVIRONMENT"];

const ev = (o) => Object.assign({
  subcategory:null, object_type:"ACTION", source_date:null, event_or_programme_date:null,
  said:null, did:null, reached:null, remained:null,
  existing_registry_match:"NO", duplicate_of:null,
  public_output_allowed:"YES", prohibited_inference:"Стадия зрелости не является оценкой или рангом."
}, o);

module.exports = {
  meta: { canon:"V8", api_current:"1.1", generated:"2026-09-29", demo:true },

  organizations: [
    { organization_id:"ORG-KZ-01", type:"COMPANY", name:"DEMO-01 · Промышленность" },
    { organization_id:"ORG-KZ-02", type:"COMPANY", name:"DEMO-02 · Логистика" },
    { organization_id:"ORG-KZ-03", type:"COMPANY", name:"DEMO-03 · Финансы" },
    { organization_id:"ORG-WD-11", type:"COMPANY", name:"DEMO-11 · Manufacturing" },
    { organization_id:"ORG-WD-12", type:"COMPANY", name:"DEMO-12 · Technology" },
    { organization_id:"ORG-WD-13", type:"COMPANY", name:"DEMO-13 · Energy" },
    { organization_id:"ORG-FED-01", type:"FEDERATION", name:"DEMO Федерация корпоративного спорта" },
    { organization_id:"ORG-CLB-01", type:"CLUB", name:"DEMO Профессиональный клуб" }
  ],

  companies: [
    { company_id:"KZ-DEMO-01", organization_id:"ORG-KZ-01", demo:true, name:"DEMO-01 · Промышленность",
      country:"KZ", industry:"Промышленность", employees_total:240, employees_source_date:"2026-06-30",
      employees_source_id:"SRC-01", publicity_level:"OPEN", league_eligible:true },
    { company_id:"KZ-DEMO-02", organization_id:"ORG-KZ-02", demo:true, name:"DEMO-02 · Логистика",
      country:"KZ", industry:"Логистика", employees_total:410, employees_source_date:"2026-05-31",
      employees_source_id:"SRC-04", publicity_level:"PARTIAL", league_eligible:true },
    { company_id:"KZ-DEMO-03", organization_id:"ORG-KZ-03", demo:true, name:"DEMO-03 · Финансы",
      country:"KZ", industry:"Финансы", employees_total:null, employees_source_date:null,
      employees_source_id:null, publicity_level:"CLOSED", league_eligible:true },
    { company_id:"WD-DEMO-11", organization_id:"ORG-WD-11", demo:true, name:"DEMO-11 · Manufacturing",
      country:"WORLD", industry:"Manufacturing", employees_total:12500, employees_source_date:"2026-03-31",
      employees_source_id:"SRC-07", publicity_level:"OPEN", league_eligible:true },
    { company_id:"WD-DEMO-12", organization_id:"ORG-WD-12", demo:true, name:"DEMO-12 · Technology",
      country:"WORLD", industry:"Technology", employees_total:3400, employees_source_date:"2026-06-30",
      employees_source_id:"SRC-09", publicity_level:"PARTIAL", league_eligible:true },
    { company_id:"WD-DEMO-13", organization_id:"ORG-WD-13", demo:true, name:"DEMO-13 · Energy",
      country:"WORLD", industry:"Energy", employees_total:8800, employees_source_date:"2026-04-30",
      employees_source_id:"SRC-11", publicity_level:"OPEN", league_eligible:true }
  ],

  sources: [
    { source_id:"SRC-01", source_type:"OFFICIAL_SITE", url:"https://example.kz/demo-01/", publisher:"DEMO-01" },
    { source_id:"SRC-02", source_type:"REPORT",        url:"https://example.kz/demo-01/report-2026.pdf", publisher:"DEMO-01" },
    { source_id:"SRC-03", source_type:"EVENT_ORGANISER", url:"https://example.kz/city-run/", publisher:"City Run" },
    { source_id:"SRC-04", source_type:"OFFICIAL_SITE", url:"https://example.kz/demo-02/", publisher:"DEMO-02" },
    { source_id:"SRC-05", source_type:"OFFICIAL_SOCIAL", url:null, publisher:"DEMO-04" },
    { source_id:"SRC-06", source_type:"REPORT",        url:"https://example.kz/demo-03/esg-2026.pdf", publisher:"DEMO-03" },
    { source_id:"SRC-07", source_type:"IR",            url:"https://example.com/demo-11/ir/2026", publisher:"DEMO-11" },
    { source_id:"SRC-08", source_type:"REPORT",        url:"https://example.com/demo-11/people-2026.pdf", publisher:"DEMO-11" },
    { source_id:"SRC-09", source_type:"OFFICIAL_SITE", url:"https://example.com/demo-12/", publisher:"DEMO-12" },
    { source_id:"SRC-10", source_type:"FEDERATION",    url:"https://example.kz/federation/", publisher:"DEMO Федерация" },
    { source_id:"SRC-11", source_type:"IR",            url:"https://example.com/demo-13/ir", publisher:"DEMO-13" }
  ],

  publications: [
    { publication_id:"PUB-01", source_id:"SRC-01", url:"https://example.kz/demo-01/sport-2026", title:"Программа корпоративного спорта 2026", published_at:"2026-09-28" },
    { publication_id:"PUB-02", source_id:"SRC-02", url:"https://example.kz/demo-01/report-2026.pdf", title:"Годовой отчёт 2026", published_at:"2026-07-15" },
    { publication_id:"PUB-03", source_id:"SRC-03", url:"https://example.kz/city-run/partners", title:"Партнёры городского забега", published_at:"2026-09-28" },
    { publication_id:"PUB-04", source_id:"SRC-06", url:"https://example.kz/demo-03/esg-2026.pdf", title:"ESG-отчёт 2026", published_at:"2026-09-26" },
    { publication_id:"PUB-05", source_id:"SRC-08", url:"https://example.com/demo-11/people-2026.pdf", title:"People report 2026", published_at:"2026-08-02" },
    { publication_id:"PUB-06", source_id:"SRC-09", url:"https://example.com/demo-12/active", title:"Active programme", published_at:"2026-09-10" },
    { publication_id:"PUB-07", source_id:"SRC-11", url:"https://example.com/demo-13/sponsorship", title:"Sponsorship disclosure", published_at:"2026-06-30" }
  ],

  /* ---- EVIDENCE: одно утверждение на строку ---- */
  evidence: [
    ev({ evidence_id:"EV-10241", company_id:"KZ-DEMO-01", block:"EMPLOYEE_SPORT", sport_contour:"EMPLOYEE",
      object_type:"PROGRAMME", claim:"Программа корпоративного спорта охватывает 240 сотрудников; опубликован знаменатель и окно измерения.",
      source_url:"https://example.kz/demo-01/sport-2026", source_type:"OFFICIAL_SITE", source_date:"2026-09-28",
      publication_id:"PUB-01", evidence_status:"VERIFIED", coverage_status:"SUFFICIENT",
      publicity_level:"OPEN", positive_stage:"MEASURED",
      said:"PROVEN", did:"PROVEN", reached:"PROVEN", remained:"PARTIAL",
      prohibited_inference:"Охват не доказывает удержание практики." }),
    ev({ evidence_id:"EV-10242", company_id:"KZ-DEMO-02", block:"PUBLIC_SPORT", sport_contour:"PUBLIC",
      object_type:"EVENT", claim:"Компания выступила партнёром городского забега. Когорта сотрудников отдельно не подтверждена.",
      source_url:"https://example.kz/city-run/partners", source_type:"EVENT_ORGANISER", source_date:"2026-09-28",
      publication_id:"PUB-03", evidence_status:"VERIFIED", coverage_status:"SUFFICIENT",
      publicity_level:"OPEN", positive_stage:"CONFIRMED",
      prohibited_inference:"Партнёрство публичного события не является программой для сотрудников." }),
    ev({ evidence_id:"EV-10243", company_id:"KZ-DEMO-03", block:"HEALTH", sport_contour:"NOT_APPLICABLE",
      object_type:"PROGRAMME", claim:"Раскрыта программа здоровья сотрудников. Знаменатель охвата не опубликован.",
      source_url:"https://example.kz/demo-03/esg-2026.pdf", source_type:"REPORT", source_date:"2026-09-26",
      publication_id:"PUB-04", evidence_status:"PARTIAL", coverage_status:"PARTIAL",
      publicity_level:"CLOSED", positive_stage:"OPENED",
      said:"PROVEN", did:"PARTIAL", reached:"NOT_DISCLOSED", remained:"NOT_DISCLOSED",
      public_output_allowed:"CONDITIONAL",
      prohibited_inference:"Раскрытие не равно подтверждённому охвату." }),
    /* --- очередь Source Recovery: прямой ссылки нет --- */
    ev({ evidence_id:"EV-10244", company_id:"KZ-DEMO-01", block:"PRO_SPORT", sport_contour:"PRO",
      object_type:"INVESTMENT", claim:"Заявлена поддержка профессионального клуба. Прямая ссылка на источник ещё не восстановлена.",
      source_url:null, source_type:"OFFICIAL_SOCIAL", source_date:null,
      publication_id:null, evidence_status:"SOURCE_PENDING", coverage_status:"NO_VERIFIED_DATA",
      publicity_level:"CLOSED", positive_stage:"DID", public_output_allowed:"NO",
      prohibited_inference:"Вклад в PRO никогда не становится аллокацией программы сотрудников." }),
    /* --- очередь Duplicate Attachments --- */
    ev({ evidence_id:"EV-10245", company_id:"KZ-DEMO-02", block:"PUBLIC_SPORT", sport_contour:"PUBLIC",
      object_type:"EVENT", claim:"Партнёрство городского забега (повторная публикация того же события).",
      source_url:"https://example.kz/city-run/partners?utm=repost", source_type:"OFFICIAL_SOCIAL", source_date:"2026-09-29",
      publication_id:"PUB-03", evidence_status:"SEARCH_INCOMPLETE", coverage_status:"NO_VERIFIED_DATA",
      publicity_level:"CLOSED", positive_stage:"DID",
      existing_registry_match:"POSSIBLE", duplicate_of:null, public_output_allowed:"NO",
      prohibited_inference:"Публикация не равна событию: повтор не создаёт новое событие." }),
    /* --- очередь Taxonomy Review: спорный блок/контур --- */
    ev({ evidence_id:"EV-10246", company_id:"WD-DEMO-12", block:"CHARITY_VOLUNTEERING", sport_contour:"NOT_APPLICABLE",
      object_type:"ACTION", claim:"Сотрудники участвовали в благотворительном забеге в рабочее время.",
      source_url:"https://example.com/demo-12/active", source_type:"OFFICIAL_SITE", source_date:"2026-09-10",
      publication_id:"PUB-06", evidence_status:"PARTIAL", coverage_status:"PARTIAL",
      publicity_level:"PARTIAL", positive_stage:"DID", taxonomy_flag:true,
      prohibited_inference:"Внешняя благотворительность не равна льготе сотрудникам." }),
    ev({ evidence_id:"EV-10247", company_id:"WD-DEMO-11", block:"EMPLOYEE_SPORT", sport_contour:"EMPLOYEE",
      object_type:"PROGRAMME", claim:"Повторный сопоставимый замер по той же когорте за два окна подряд.",
      source_url:"https://example.com/demo-11/people-2026.pdf", source_type:"REPORT", source_date:"2026-08-02",
      publication_id:"PUB-05", evidence_status:"VERIFIED", coverage_status:"SUFFICIENT",
      publicity_level:"OPEN", positive_stage:"STRENGTHENED",
      said:"PROVEN", did:"PROVEN", reached:"PROVEN", remained:"PROVEN",
      prohibited_inference:"Сопоставимое изменение не доказывает причинность." }),
    ev({ evidence_id:"EV-10248", company_id:"WD-DEMO-13", block:"PRO_SPORT", sport_contour:"PRO",
      object_type:"INVESTMENT", claim:"Подтверждено спонсорство профессионального спорта с раскрытой суммой.",
      source_url:"https://example.com/demo-13/sponsorship", source_type:"IR", source_date:"2026-06-30",
      publication_id:"PUB-07", evidence_status:"VERIFIED", coverage_status:"SUFFICIENT",
      publicity_level:"OPEN", positive_stage:"CONFIRMED",
      prohibited_inference:"Сумма PRO не переносится в контур сотрудников." }),
    /* --- отклонённое: в реестр не попадает, в проекцию тем более --- */
    ev({ evidence_id:"EV-10249", company_id:"KZ-DEMO-01", block:"HEALTH", sport_contour:"NOT_APPLICABLE",
      object_type:"CLAIM", claim:"Утверждение из вторичного пересказа без первоисточника.",
      source_url:null, source_type:"OFFICIAL_SOCIAL", source_date:null,
      publication_id:null, evidence_status:"REJECTED", coverage_status:"NO_VERIFIED_DATA",
      publicity_level:"CLOSED", positive_stage:"NOT_APPLICABLE", public_output_allowed:"NO",
      prohibited_inference:"Отклонённое доказательство не входит в реестр публичных фактов." })
  ],

  events: [
    { event_id:"EVT-01", company_id:"KZ-DEMO-01", name:"Корпоративная спартакиада", date:"2026-05-17",
      block:"EMPLOYEE_SPORT", sport_contour:"EMPLOYEE", publication_ids:["PUB-01"] },
    { event_id:"EVT-02", company_id:"KZ-DEMO-02", name:"Городской забег · партнёрство", date:"2026-09-20",
      block:"PUBLIC_SPORT", sport_contour:"PUBLIC", publication_ids:["PUB-03"] },
    { event_id:"EVT-03", company_id:"WD-DEMO-11", name:"Internal championship · season 4", date:"2026-06-01",
      block:"EMPLOYEE_SPORT", sport_contour:"EMPLOYEE", publication_ids:["PUB-05"] }
  ],

  programmes: [
    { programme_id:"PRG-EMP-SPORT-2026", company_id:"KZ-DEMO-01", block:"EMPLOYEE_SPORT",
      window:"2026-01-01 … 2026-06-30", cohort:"Штатные сотрудники на 2026-01-01",
      regular_rule_declared:true, regular_rule:"Не менее 2 занятий в неделю в течение окна",
      budget:{ amount:7200000, currency:"KZT", period:"ANNUAL", contour:"EMPLOYEE_PROGRAMME" },
      chain:{ employees_total:240, eligible:240, aware:188, first_use:96, regular:41 },
      cycle:{ registered:120, started:98, finished:74, returned:39, sustained_180_plus:null,
              first_time_users:63, returned_first_time_users:21, window_declared:true, m1:31, m2:41, comparable:true } },
    { programme_id:"PRG-EMP-SPORT-2026-L", company_id:"KZ-DEMO-02", block:"EMPLOYEE_SPORT",
      window:"2026-01-01 … 2026-06-30", cohort:"Водители и склад",
      regular_rule_declared:false, regular_rule:null,
      budget:{ amount:null, currency:"KZT", period:"ANNUAL", contour:"GENERAL" },
      chain:{ employees_total:410, eligible:410, aware:150, first_use:61, regular:null },
      cycle:{ registered:70, started:52, finished:null, returned:null, sustained_180_plus:null,
              first_time_users:null, returned_first_time_users:null, window_declared:false, m1:null, m2:null, comparable:false } },
    { programme_id:"PRG-GLOBAL-MOVE", company_id:"WD-DEMO-11", block:"EMPLOYEE_SPORT",
      window:"2025-07-01 … 2026-06-30", cohort:"All permanent staff",
      regular_rule_declared:true, regular_rule:"At least 2 sessions per week across the window",
      budget:{ amount:1850000, currency:"EUR", period:"ANNUAL", contour:"EMPLOYEE_PROGRAMME" },
      chain:{ employees_total:12500, eligible:11800, aware:9100, first_use:5200, regular:2650 },
      cycle:{ registered:6100, started:5200, finished:4100, returned:2380, sustained_180_plus:1720,
              first_time_users:2900, returned_first_time_users:1240, window_declared:true, m1:2310, m2:2650, comparable:true } },
    { programme_id:"PRG-TECH-ACTIVE", company_id:"WD-DEMO-12", block:"EMPLOYEE_SPORT",
      window:"2026-01-01 … 2026-06-30", cohort:"HQ + remote",
      regular_rule_declared:true, regular_rule:"Weekly activity logged in the internal app",
      budget:{ amount:null, currency:"USD", period:"ANNUAL", contour:"GENERAL" },
      chain:{ employees_total:3400, eligible:3400, aware:2100, first_use:980, regular:410 },
      cycle:{ registered:1200, started:980, finished:640, returned:290, sustained_180_plus:null,
              first_time_users:520, returned_first_time_users:170, window_declared:true, m1:null, m2:null, comparable:false } }
  ],

  relationships: [
    { relationship_id:"REL-01", company_id:"KZ-DEMO-01", counterparty_id:"ORG-CLB-01", type:"SPONSORSHIP",
      sport_contour:"PRO", from:"2025-01-01", to:null, source_id:"SRC-05", verified:false },
    { relationship_id:"REL-02", company_id:"KZ-DEMO-02", counterparty_id:"ORG-FED-01", type:"MEMBERSHIP",
      sport_contour:"PUBLIC", from:"2024-06-01", to:null, source_id:"SRC-10", verified:true },
    { relationship_id:"REL-03", company_id:"WD-DEMO-13", counterparty_id:"ORG-CLB-01", type:"SPONSORSHIP",
      sport_contour:"PRO", from:"2023-01-01", to:null, source_id:"SRC-11", verified:true }
  ],

  achievements: [
    { achievement_id:"ACH-01", company_id:"KZ-DEMO-01", contour:"EMPLOYEE", title:"Корпоративная спартакиада, 2026", date:"2026-05-17", source_id:"SRC-01" },
    { achievement_id:"ACH-02", company_id:"KZ-DEMO-01", contour:"PRO", title:"Партнёрство с профессиональным клубом", date:"2025-01-01", source_id:"SRC-05" },
    { achievement_id:"ACH-03", company_id:"WD-DEMO-11", contour:"EMPLOYEE", title:"Internal championship, 4th season", date:"2026-06-01", source_id:"SRC-08" },
    { achievement_id:"ACH-04", company_id:"WD-DEMO-11", contour:"PRO", title:"League title partnership", date:"2024-09-01", source_id:"SRC-07" },
    { achievement_id:"ACH-05", company_id:"WD-DEMO-13", contour:"PRO", title:"Sponsor of a professional team", date:"2023-01-01", source_id:"SRC-11" },
    { achievement_id:"ACH-06", company_id:"WD-DEMO-12", contour:"EMPLOYEE", title:"Employee running club", date:"2026-03-01", source_id:"SRC-09" }
  ],

  cases: [
    { case_id:"CASE-01", company_id:"KZ-DEMO-01", title:"Знаменатель вместо оценки на глаз",
      did:"Открыт зал на площадке и объявлено правило регулярности.",
      measured:"Замерены eligible, aware, first_use, regular в одном окне.",
      not_claimed:"Изменение больничных не приписывается программе: причинность не доказана.",
      source_id:"SRC-01" },
    { case_id:"CASE-02", company_id:"WD-DEMO-11", title:"Второй сопоставимый замер",
      did:"Повторён цикл на той же когорте в эквивалентном окне.",
      measured:"M1 → M2 с сохранением определения регулярности.",
      not_claimed:"Рост не объявляется эффектом программы без отдельного доказательства.",
      source_id:"SRC-08" },
    { case_id:"CASE-03", company_id:"KZ-DEMO-02", title:"Публичный забег — это внешний контур",
      did:"Компания выступила партнёром городского забега.",
      measured:"Подтверждён факт партнёрства и его объём.",
      not_claimed:"Участие сотрудников во внутренний контур не засчитано: когорта не подтверждена.",
      source_id:"SRC-03" }
  ],

  releases: [
    { release_id:"REL-2026-09-29-09", slot:"09:00", at:"2026-09-29T09:00:00+05:00",
      evidence_ids:["EV-10241","EV-10242","EV-10247","EV-10248"],
      kz_discovery:"KZ-DEMO-03", world_discovery:"WD-DEMO-13", published:true }
  ],

  BLOCKS
};
