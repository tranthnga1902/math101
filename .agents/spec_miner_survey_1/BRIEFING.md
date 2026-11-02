# BRIEFING — 2026-09-13T07:04:00Z

## Mission
Conduct a comprehensive specification & requirements mining for Textbook (SGK/SBT) features, metadata, page offset calculations, RBAC, API endpoints, acceptance criteria, and edge cases for MATH9 / MATH10 Web Demo.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Specification & Requirements Miner
- Working directory: c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/
- Original parent: 50a935d1-4f71-4466-94a3-0d6d3d36d038
- Milestone: Textbook (SGK/SBT) Specification Survey

## 🔒 Key Constraints
- Read-only regarding application source code (do not implement features, only discover and document).
- Probe authoritative sources (ORIGINAL_REQUEST.md, MATH10_MASTER_PLAN.md, existing Prisma schema, DB migrations, existing API routes, UI components).
- Document exact formula: pdfPage = bookPage + (base_page_offset - 1), 1-indexed semantics, calibration rules.
- Document full RBAC matrix (ADMIN vs TEACHER/STUDENT).
- Document API endpoints with request/response schemas and error conditions (400, 401, 403, 404).
- Write spec_report.md and handoff.md in working directory.
- Send completion message to parent via send_message.

## Current Parent
- Conversation ID: 50a935d1-4f71-4466-94a3-0d6d3d36d038
- Updated: 2026-09-13T07:04:00Z

## Task Summary
- **What to build**: Specification report for textbook catalog, viewer, and offset calibration.
- **Success criteria**: Exhaustive spec_report.md and self-contained handoff.md covering all 5 sections.
- **Interface contracts**: API schemas, DB model schemas, calculation contracts.
- **Code layout**: Survey repo schema and routes, outputs in `.agents/spec_miner_survey_1/`.

## Key Decisions Made
- Extensively investigated `ORIGINAL_REQUEST.md`, `MATH10_MASTER_PLAN.md` §3, Flyway migrations `V202607291700`, `V202607310000`, `V202607311800`, `V202608040500`, Java backend controllers/services/entities, and React UI reader components.
- Highlighted the critical route discrepancy between `/api/textbooks/**` (requested by ORIGINAL_REQUEST and MASTER_PLAN) and `/api/documents/textbooks/**` (current repo mapping), plus GET vs POST on `/open`.
- Documented missing Student audience filter in `listTextbooks`.
- Delivered `spec_report.md` and `handoff.md`.

## Artifact Index
- `.agents/spec_miner_survey_1/DISPATCH.md` — Dispatch instructions
- `.agents/spec_miner_survey_1/BRIEFING.md` — Working context & identity
- `.agents/spec_miner_survey_1/progress.md` — Progress tracker and heartbeat
- `.agents/spec_miner_survey_1/spec_report.md` — Comprehensive specification report
- `.agents/spec_miner_survey_1/handoff.md` — 5-component handoff report
