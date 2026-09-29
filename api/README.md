# KCSL API · Backstage

Реализация пакета **KCSL V8 DEVELOPER PACKAGE** (28.09.2026) на дизайн-системе ADCS Kazakhstan.

## Запуск

```bash
node api/server.js
```

Зависимостей нет — только стандартная библиотека Node.js.

| Адрес | Что это |
|---|---|
| `http://localhost:8787/kcsl.html` | публичная страница KCSL |
| `http://localhost:8787/backstage.html` | Backstage (нужен токен оператора) |
| `http://localhost:8787/api` | индекс контракта и правил |

Переменные окружения:

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `KCSL_PORT` | `8787` | порт |
| `KCSL_OPERATOR_TOKEN` | `dev-operator` | токен Backstage |
| `KCSL_CORE_ENABLED` | выключено | feature-gate для `/core` |

## Тесты

```bash
node api/test.js
```

64 проверки: не «страница открылась», а сами правила канона — применимость блоков,
границы входов, запрет автоверификации, неизменяемость фактов источника,
приоритет приватности над публичностью, честность журнала аудита.

## Версионирование

`API Projection Contract V1.1` — текущая база, ломать нельзя.
Поля и эндпоинты V8 помечены **PROPOSED** и отдаются только по явному запросу:

```
GET /companies/KZ-DEMO-01              → V1.1, без V8-полей
GET /companies/KZ-DEMO-01?version=8    → добавлены positive_stage, publicity_level, blocks, …
GET /companies/KZ-DEMO-01/calculators  → 409 PROPOSED_ENDPOINT
```

Тот же результат даёт заголовок `X-KCSL-API-Version: 8`.

## Эндпоинты

**CURRENT V1.1** — `/live`, `/companies`, `/companies/{id}`, `/companies/{id}/events`,
`/companies/{id}/sport`, `/companies/{id}/relationships`, `/companies/{id}/achievements`,
`/companies/{id}/cases`, `/companies/{id}/core` (feature-gated), `/sport`, `/cases`,
`/season/current`, `POST /company-applications`, `POST /evidence-submissions`.

**PROPOSED V8** — `/companies/{id}/evidence`, `/companies/{id}/participation`,
`/companies/{id}/calculators`, `POST /calculators/evaluate`, `/releases/current`,
`/releases/{release_id}`.

**Backstage** (заголовок `X-KCSL-Operator`) — `/backstage/queues`,
`/backstage/queues/{name}`, `POST /backstage/evidence/{id}/review`,
`POST /backstage/evidence/{id}/resolve-source`,
`POST /backstage/companies/{id}/publicity`, `/backstage/release/readiness`,
`POST /backstage/release/publish`, `/backstage/audit`, `/backstage/staging`.

## Правила, встроенные в код

| Контроль | Где обеспечивается |
|---|---|
| `FRONT_CALCULATION = 0` | весь расчёт в `lib/calculator.js`; страница вызывает `POST /calculators/evaluate` |
| `NO_DATA_AS_ZERO = 0` | `num()` возвращает `null`, отсутствующие входы → `NOT_CALCULABLE` |
| `AUTO_VERIFIED = 0` | `ACCEPT_VERIFIED` отклоняется без прямой ссылки |
| `PRO_PUBLIC_BUDGET_AS_EMPLOYEE = 0` | `cost_per_regular` требует контур `EMPLOYEE_PROGRAMME` |
| `RETURN_AS_SUSTAINED = 0` | `sustained_180_plus` — отдельный вход, из `returned` не выводится |
| `COMPLETION_AS_REGULAR = 0` | `regular` не принимается без заранее объявленного правила |
| `DIVIDE_BY_ZERO = 0` | `regular > 0` и `finished > 0` проверяются явно |
| `OPEN_BYPASSES_NOT_PUBLIC = 0` | ворота приватности стоят перед воротами PD-04 |
| `REJECTED_PUBLIC = 0`, `DUPLICATE_NEW_EVENT = 0` | фильтр `passesVerification` |
| `UNAPPROVED_SCORE_OR_THRESHOLD = 0` | `/core` и `/season/current` отдают `null` в score-полях |
| Неизменяемость фактов источника | `IMMUTABLE_SOURCE_FACTS` в `lib/review.js` |

## Хранилище

`api/data/registry.json` — MASTER, `staging.json` — присланное, `audit.json` — журнал.
При первом запуске MASTER создаётся из `registry.seed.js`. Запись идёт только через
`store.commit()`: при отказе мутатора MASTER не переписывается, а журнал фиксирует
исход — `APPLIED`, `REFUSED` или `ERROR`.

Файлы JSON — это заглушка слоя хранения для разработки. Схемы сущностей соответствуют
`KCSL_V8_DATA_CONTRACT`, поэтому замена на СУБД не затрагивает проекцию и API.

## Что осталось TO_DEFINE

Три пункта канона не реализованы намеренно — они не утверждены:

1. кроссволк 9×90 Closed Loop;
2. агрегация разрывов и математические пороги семи профилей;
3. численные правила покрытия `SUFFICIENT` / `INSUFFICIENT`.

Поэтому `coverage_status` берётся из решения ревью, а не вычисляется формулой.
