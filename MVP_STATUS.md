# MATH10 FINAL SPEC — MVP verification status

Updated: 2026-07-27 23:37 (Asia/Saigon)

## Verified implementation

| FINAL SPEC area | Current evidence |
| --- | --- |
| Required stack | React 19 + Vite 7 + TypeScript 5 + Tailwind 4 Vite plugin + Shadcn-style Radix/CVA primitives + Lucide; Java 17/Spring Boot 3; Supabase PostgreSQL |
| Auth, account status, reset, RBAC/IDOR | Backend security/service tests; staging Teacher/Student login and ownership checks |
| Admin user/config/dashboard/audit | Implemented for User, Subject, Grade, Topic, Course, Problem and Class; positive staging acceptance passed with a real bootstrapped Admin |
| Teacher dashboard and classes | Staging Teacher created a class and was automatically assigned as its owner |
| Gradebook matrix | Staging transition verified: `NOT_OPENED → IN_PROGRESS → COMPLETED` |
| Lesson Builder | `content_html`, debounced draft save, Text/Video/PDF/Image resources and worksheet attachment |
| PRACTICE/EXAM | Staging: PRACTICE QR length 8; EXAM QR null; EXAM hint and worksheet insertion rejected |
| Manual similar problems | Public API returned `EASIER,EQUIVALENT,HARDER` from the three configured problem IDs |
| Worksheet and QR | PRACTICE-only, A4 1/2-column print, `react-to-print`, KaTeX, stable QR and PNG download |
| Student learning | Student has an online lesson view with video/content/resources, curriculum sidebar/drawer, attached worksheet callout and progress tracking |
| Public QR progress | Student progress reached `COMPLETED`; hints reveal sequentially and solutions use an accordion |
| Unified learning progress | Worksheet progress persisted as `COMPLETED` in `learning_progress` |
| OpenAPI | OpenAPI 3.0.3, contract 1.3.0, 42 paths; YAML parses successfully |

## Latest acceptance evidence

- Backend: `mvn.cmd clean test` — **19 tests, 0 failures**.
- Frontend: ESLint and TypeScript — **passed**.
- Frontend: `npm.cmd run build` — **passed** after Tailwind/Shadcn/Lucide integration.
- Dependency audit: **0 production vulnerabilities; 0 total vulnerabilities** after compatible ESLint upgrade.
- Supabase/Flyway: **11 migrations validated**, migration
  `V202607272120__soft_delete_worksheet_items.sql` applied successfully;
  schema is now **v202607272120**.
- `scripts/staging-full-e2e.ps1` — **all 12 assertions passed** after the latest migration.
- `scripts/staging-math-smoke.ps1` — **all 9 assertions passed** after the latest migration.
- `scripts/staging-admin-e2e.ps1` — **all 9 assertions passed twice**,
  including once after restart with Admin bootstrap disabled.
- Backend health: `http://localhost:8080/actuator/health` — **UP**.
- Frontend: `http://localhost:3000` — **HTTP 200**, one strict-port Vite process.

## Acceptance result

All FINAL SPEC MVP acceptance gates are complete. The one-time Admin bootstrap
is disabled in the running backend. The persistent staging Admin credential is
stored locally in `.admin-staging-credentials.txt`, which is excluded from Git.
