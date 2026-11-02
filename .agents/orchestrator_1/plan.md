# Master Implementation Plan: Textbook Management & PDF Reading System

## Executive Summary
This plan details the full-stack engineering workflow to implement the Textbook (SGK/SBT) catalog and PDF reading system across Admin, Teacher, and Student roles with 100% test passing and acceptance criteria fulfillment.

---

## Phase 0: Survey & Requirements Mining [COMPLETED]
- [x] Extract full specifications and formulas (`spec_miner_survey_1`) -> `spec_report.md`
- [x] Survey backend Flyway, entities, security, controllers, and test suite (`explorer_backend_survey_1`) -> `backend_report.md`
- [x] Survey frontend components, routing, PDF engine, and build/lint (`explorer_frontend_survey_1`) -> `frontend_report.md`
- [x] Establish `PROJECT.md` with Feature Inventory and Interface Contracts

---

## Phase 1: Milestone 1 — Flyway Database Migration & Seeding
**Goal**: Create incremental Flyway migration `V202609131400__align_textbook_schema_and_seed.sql` with catalog indexing and baseline seed textbooks.
- Worker task:
  - Add composite index on `documents(doc_type, status, grade_id, subject_id)`.
  - Seed Grade 10 Math textbooks (`SGK Toán 10 Tập 1`, `SGK Toán 10 Tập 2`, `SBT Toán 10`) with `PUBLISHED` and `DRAFT` statuses, initial `total_pages` and `base_page_offset`.
  - Verify migration executes cleanly with `mvn test -Dtest=DocumentAccessTest` without schema errors.
- Verification Gate: Reviewer + Challenger + Forensic Auditor.

---

## Phase 2: Milestone 2 — Spring Boot Backend REST APIs, RBAC & Offset Engine
**Goal**: Deliver dedicated, secure REST controllers with page offset calculation and full unit/integration test suite.
- Worker task:
  - Create `AdminTextbookController` under `@RequestMapping("/api/admin/textbooks")` with `@PreAuthorize("hasRole('ADMIN')")`:
    - `POST` create/upload textbook metadata
    - `GET` list all textbooks with filters (gradeId, subjectId, status, search)
    - `GET /{id}` detail
    - `PUT /{id}` update metadata & offset
    - `PATCH /{id}/publish` publish textbook
    - `PATCH /{id}/hide` hide textbook
    - `DELETE /{id}` soft-delete via `markDeleted()`
  - Create `TextbookController` under `@RequestMapping("/api/textbooks")`:
    - `GET` list published textbooks (filter `audience = STUDENT_ALLOWED` if caller is Student)
    - `GET /{id}` detail
    - `GET /{id}/open` & `POST /{id}/open` calculate `pdfPage = bookPage + (base_page_offset - 1)` with boundary checks
  - Maintain compatibility aliases in `AdminDocumentController` and `DocumentController`.
  - Unit tests: `TextbookOffsetTest` (formula, edge cases, boundaries).
  - Integration tests: `AdminTextbookControllerTest`, `TextbookControllerTest`.
  - Verify `mvn clean test` runs with 0 failures.
- Verification Gate: Reviewer x2 + Challenger x2 + Forensic Auditor.

---

## Phase 3: Milestone 3 — React Frontend Management, Catalog & Reader UI
**Goal**: Deliver modern, responsive UI for Admin management, Teacher/Student catalog, and PDF reader with offset calibration.
- Worker task:
  - Upgrade `src/admin/TextbookManagement.tsx`:
    - Filter bar (grade, subject, status, search)
    - Upload / Create modal with metadata fields (title, grade, subject, docType, totalPages, basePageOffset, fileUrl, audience)
    - Edit modal for metadata and offset
    - Publish, hide, delete actions
    - Launch reader in Admin preview/calibration mode
  - Create `src/textbooks/TextbookCatalog.tsx`:
    - Responsive card grid for Teacher and Student
    - Filter by grade (Grade 10), subject, docType (SGK / SBT), live search
    - Quick book page jump input & read button
  - Create `src/textbooks/TextbookReader.tsx`:
    - Clean PDF rendering using `pdfjs-dist`
    - Dual-page indicators (`Trang sách: X` / `Trang PDF: Y`)
    - Jump-to-printed-book-page input
    - Admin Calibration Bar with 1-click "Đặt trang PDF này làm Trang 1", offset stepper, live preview, and save button
  - Navigation & Integration:
    - Add `teacher-textbooks` to Teacher sidebar in `src/layout/Sidebar.tsx` and route in `src/App.tsx`
    - Update `src/teacher/TextbookBrowser.tsx` and `src/student/StudentExperience.tsx`
    - Standardize API calls in `src/api.ts`
  - Verify `npm run build` and `npm run lint` with 0 errors.
- Verification Gate: Reviewer x2 + Challenger x2 + Forensic Auditor.

---

## Phase 4: Milestone 4 — E2E Staging Script Automation & Final Victory Gate
**Goal**: Deliver `scripts/staging-textbook-e2e.ps1` and execute complete end-to-end verification.
- Test Writer / Worker task:
  - Implement `scripts/staging-textbook-e2e.ps1` testing:
    1. Admin login & JWT retrieval
    2. Admin textbook creation via `POST /api/admin/textbooks`
    3. Admin publish toggle via `PATCH /api/admin/textbooks/{id}/publish`
    4. Student/Teacher query via `GET /api/textbooks` (verifying presence)
    5. Offset calculation on `GET /api/textbooks/{id}/open?bookPage=10` (verifying `pdfPage == 10 + offset - 1`)
    6. Admin hide toggle via `PATCH /api/admin/textbooks/{id}/hide`
    7. Student query rejection (book no longer in public catalog, 403 on `/open`)
    8. RBAC security: student token accessing `/api/admin/textbooks` rejected with 403; unauthenticated rejected with 401
    9. Admin soft delete via `DELETE /api/admin/textbooks/{id}`
  - Execute full test suites:
    - `mvn clean test` (0 failures)
    - `npm run build` (0 errors)
    - `npm run lint` (0 errors)
    - Run staging script assertions
- Verification Gate: Reviewer x2 + Challenger x2 + Forensic Auditor -> Final Victory Report to Sentinel.
