# BRIEFING — 2026-09-13T06:58:38+07:00

## Mission
Lead the full-stack engineering effort to build a production-ready Textbook (Sách giáo khoa / SBT) catalog and PDF reading system for the MATH10 web platform across Admin, Teacher, and Student roles adhering to ORIGINAL_REQUEST.md.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/orchestrator_1/
- Original parent: Sentinel
- Original parent conversation ID: 9284f971-01ee-41f7-80be-568302b0ede5

## 🔒 My Workflow
- **Pattern**: Project Pattern (Survey -> Decompose & Plan -> Milestone Execution Loop -> Dual Track Verification)
- **Scope document**: c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/PROJECT.md
1. **Decompose**: Survey authoritative codebase & requirements via 3 parallel explorers/spec_miner, formulate PROJECT.md & plan.md.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: For each milestone: Explorer(s) -> Worker -> Reviewers (x2) -> Challengers (x2) -> Forensic Auditor -> Gate.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical, never skip auditor)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent as last resort
4. **Succession**: Threshold: 16 spawns. Write handoff.md, cancel crons, spawn successor.
- **Work items**:
  1. Survey & Requirements Enumeration [in-progress]
  2. Database Schema & Flyway Migrations [pending]
  3. Spring Boot Backend APIs & Services (RBAC + Offset) [pending]
  4. React Frontend Components (Admin, Catalog, Reader) [pending]
  5. E2E Test Automation & Verification [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Survey codebase architecture, dependencies, existing endpoints and conventions

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder and PROJECT.md.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Audit is a binary veto: if Forensic Auditor reports INTEGRITY VIOLATION, milestone fails unconditionally.

## Current Parent
- Conversation ID: 9284f971-01ee-41f7-80be-568302b0ede5
- Updated: not yet

## Key Decisions Made
- Top-level project orchestration started in orchestrator_1.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| spec_miner_survey_1 | teamwork_preview_spec_miner | Phase 0 Requirements & Spec Survey | in-progress | b989aec0-a0bb-4973-aac5-7d93f5caac8c |
| explorer_backend_survey_1 | teamwork_preview_explorer | Phase 0 Backend Codebase Survey | in-progress | d250eb2c-0577-4c19-88a4-b775ecc06725 |
| explorer_frontend_survey_1 | teamwork_preview_explorer | Phase 0 Frontend Codebase Survey | in-progress | aa470031-a68e-4ccc-8813-7dec6daa5bfa |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: b989aec0-a0bb-4973-aac5-7d93f5caac8c, d250eb2c-0577-4c19-88a4-b775ecc06725, aa470031-a68e-4ccc-8813-7dec6daa5bfa
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 50a935d1-4f71-4466-94a3-0d6d3d36d038/task-18
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/ORIGINAL_REQUEST.md — Authoritative User Request
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/orchestrator_1/DISPATCH.md — Dispatch log
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/orchestrator_1/progress.md — Liveness & progress tracker
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/orchestrator_1/plan.md — Detailed engineering execution plan
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/PROJECT.md — Global project architecture & feature inventory
