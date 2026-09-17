# Project: MATH10 Textbook (SGK/SBT) Catalog & PDF Reading System

## Architecture
- **Backend**: Spring Boot 3.3.5, Java 17, Spring Security with JWT RBAC (`ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT`), Flyway migrations with Zonky embedded PostgreSQL 16.14.0 for testing, Hibernate with `@SQLRestriction("deleted_at IS NULL")`.
- **Frontend**: React 19, TypeScript, Vite 7.3.6, Tailwind CSS, Lucide icons, `pdfjs-dist` 4.7.76 with custom canvas renderer `pdfCore.ts`.
- **Data Flow**:
  1. Admin creates/edits textbook metadata (title, subjectId, gradeId, docType, totalPages, basePageOffset, fileUrl, audience) via `POST/PUT /api/admin/textbooks`.
  2. Flyway migration `V202609131400__align_textbook_schema_and_seed.sql` ensures schema indexing and seed textbook data.
  3. Admin publishes/hides/soft-deletes books via `PATCH /api/admin/textbooks/{id}/publish`, `PATCH /api/admin/textbooks/{id}/hide`, `DELETE /api/admin/textbooks/{id}`.
  4. Teacher and Student browse published textbooks via `GET /api/textbooks` (Student filtered by `audience = STUDENT_ALLOWED`).
  5. Teacher and Student open books via `GET /api/textbooks/{id}/open?bookPage=N` (or POST), returning `{ id, title, fileUrl, totalPages, basePageOffset, bookPage, pdfPage }` where `pdfPage = bookPage + (base_page_offset - 1)`.
  6. Frontend `TextbookReader` renders PDF at `pdfPage` and provides dual-page navigation and Admin Calibration Bar.

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone.
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Flyway Schema & Seed Migration | Incremental Flyway migration `V202609131400`, catalog composite index, seed SGK Math 10 books | M1 | Survey / Flyway |
| F2 | Admin Textbook REST APIs | `POST/GET/PUT/PATCH/DELETE` on `/api/admin/textbooks/**`, RBAC `ROLE_ADMIN` only, 401/403 rejection | M2 | Survey / Spec |
| F3 | Public / Catalog REST APIs | `GET /api/textbooks`, `GET /api/textbooks/{id}`, `GET /api/textbooks/{id}/open`, offset mapping, student audience check | M2 | Survey / Spec |
| F4 | Backend Unit & Integration Tests | `TextbookOffsetTest`, `AdminTextbookControllerTest`, `TextbookControllerTest`, 0 failures with `mvn clean test` | M2 | Acceptance Criteria |
| F5 | Admin Textbook Management UI | Upgraded `TextbookManagement.tsx` with search, filters, modals for create & edit, publish/hide, delete | M3 | Survey / Frontend |
| F6 | Teacher & Student Catalog UI | Shared `TextbookCatalog.tsx` with search, grade/subject filters, book cards, quick book-page jump | M3 | Survey / Frontend |
| F7 | Textbook Reader & Calibration UI | Dedicated `TextbookReader.tsx` with dual-page display, offset calibration bar for Admin, jump-to-page | M3 | Survey / Frontend |
| F8 | Role Navigation & API Client | Adding `teacher-textbooks` to Teacher sidebar, linking student tab, updating `src/api.ts` | M3 | Survey / Frontend |
| F9 | E2E Staging Script Automation | Automated PowerShell script `scripts/staging-textbook-e2e.ps1` testing full lifecycle and assertions 100% | M4 | Acceptance Criteria |
| F10 | Final Dual-Track Gate Verification | Run full backend tests (`mvn clean test`), frontend build (`npm run build`), lint (`npm run lint`), and E2E script | M4 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema & Flyway Migration | Migration `V202609131400`, catalog indexing, seed data | none | PLANNED |
| M2 | Backend REST APIs, RBAC & Offset Engine | `AdminTextbookController`, `TextbookController`, DTOs, service methods, tests | M1 | PLANNED |
| M3 | Frontend Textbook Management, Catalog & Reader | `TextbookManagement.tsx`, `TextbookCatalog.tsx`, `TextbookReader.tsx`, navigation, `api.ts` | M2 | PLANNED |
| M4 | E2E Staging Automation & Verification Gate | `staging-textbook-e2e.ps1`, `mvn clean test`, `npm run build`, `npm run lint`, full audit | M3 | PLANNED |

## Interface Contracts

### Admin Textbook API
- `POST /api/admin/textbooks`
  - Headers: `Authorization: Bearer <token>`
  - Request Body:
    ```json
    {
      "title": "SGK Toán 10 - Tập 1 (Kết nối tri thức)",
      "subjectId": 1,
      "gradeId": 10,
      "docType": "SGK",
      "totalPages": 120,
      "basePageOffset": 5,
      "fileUrl": "https://storage.../toan10_tap1.pdf",
      "thumbnailUrl": "https://storage.../thumb.png",
      "audience": "STUDENT_ALLOWED",
      "status": "DRAFT"
    }
    ```
  - Response 201 Created: `TextbookDetailResponse`
  - Security: 401 Unauthorized, 403 Forbidden (Non-Admin)

- `GET /api/admin/textbooks`
  - Query params: `gradeId`, `subjectId`, `status`, `search`
  - Response 200 OK: `List<TextbookResponse>`

- `GET /api/admin/textbooks/{id}`
  - Response 200 OK: `TextbookDetailResponse`

- `PUT /api/admin/textbooks/{id}`
  - Request Body: fields to update (title, totalPages, basePageOffset, etc.)
  - Response 200 OK: `TextbookDetailResponse`

- `PATCH /api/admin/textbooks/{id}/publish`
  - Response 200 OK: `TextbookDetailResponse` (`status: "PUBLISHED"`)

- `PATCH /api/admin/textbooks/{id}/hide`
  - Response 200 OK: `TextbookDetailResponse` (`status: "HIDDEN"`)

- `DELETE /api/admin/textbooks/{id}`
  - Response 204 No Content (soft delete `deleted_at = NOW()`)

### Catalog & Reader API
- `GET /api/textbooks`
  - Query params: `gradeId`, `subjectId`
  - Response 200 OK: `List<TextbookResponse>` (only `status: "PUBLISHED"`, student only receives `audience: "STUDENT_ALLOWED"`)

- `GET /api/textbooks/{id}`
  - Response 200 OK: `TextbookDetailResponse`

- `GET /api/textbooks/{id}/open?bookPage={N}` and `POST /api/textbooks/{id}/open`
  - Response 200 OK:
    ```json
    {
      "documentId": 1,
      "title": "SGK Toán 10 - Tập 1",
      "fileUrl": "https://...",
      "totalPages": 120,
      "basePageOffset": 5,
      "bookPage": 10,
      "pdfPage": 14
    }
    ```
  - Calculation: `pdfPage = bookPage + (basePageOffset - 1)`. When `bookPage = 1`, `pdfPage = basePageOffset`. Clamped within `[1, totalPages]`.

## Code Layout
- Backend:
  - Migration: `math10-backend/src/main/resources/db/migration/V202609131400__align_textbook_schema_and_seed.sql`
  - Controllers:
    - `math10-backend/src/main/java/com/math10/documents/controller/AdminTextbookController.java`
    - `math10-backend/src/main/java/com/math10/documents/controller/TextbookController.java`
  - DTOs: `math10-backend/src/main/java/com/math10/documents/dto/`
  - Services: `math10-backend/src/main/java/com/math10/documents/service/`
  - Tests:
    - `math10-backend/src/test/java/com/math10/documents/TextbookOffsetTest.java`
    - `math10-backend/src/test/java/com/math10/documents/AdminTextbookControllerTest.java`
    - `math10-backend/src/test/java/com/math10/documents/TextbookControllerTest.java`
- Frontend:
  - Components:
    - `src/admin/TextbookManagement.tsx` (Admin management)
    - `src/textbooks/TextbookCatalog.tsx` (Shared Teacher & Student catalog)
    - `src/textbooks/TextbookReader.tsx` (Reader with offset & calibration bar)
  - Navigation & Views:
    - `src/layout/Sidebar.tsx`
    - `src/App.tsx`
    - `src/teacher/TextbookBrowser.tsx`
    - `src/student/StudentExperience.tsx`
    - `src/api.ts`
- Automation:
  - Staging script: `scripts/staging-textbook-e2e.ps1`
