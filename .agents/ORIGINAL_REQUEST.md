# Original User Request

## 2026-09-12T23:58:15Z

Build a production-ready Textbook (Sách giáo khoa / SBT) catalog and PDF reading system for the MATH10 web platform across Admin, Teacher, and Student roles, covering database migrations, Spring Boot REST APIs, and React frontend reader interfaces with page offset calibration.

Working directory: c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel
Integrity mode: development

Reference: MATH10_MASTER_PLAN.md (Section "Danh Mục Sách Giáo Khoa")

## Requirements

### R1. Textbook Catalog & Metadata Management (Admin)
Admin users can manage the textbook library, including creating/uploading textbook/workbook records with metadata (title, subject, grade, total pages, base page offset), publishing or hiding books, updating book details, and soft-deleting records. The `base_page_offset` represents the 1-indexed PDF page where book page 1 begins.

### R2. Textbook Exploration and Reading (Teacher & Student)
Teachers and Students can browse published textbooks by grade and subject in a responsive catalog. Selecting a textbook launches the reader interface. When a user navigates to a physical book page number, the system calculates and jumps to the exact corresponding PDF page using `pdfPage = bookPage + (base_page_offset - 1)`.

### R3. Access Control & System Architecture Constraints
Enforce role-based access control: only Admins can create, modify, publish, hide, or delete textbooks; Teachers and Students may only query published textbooks permitted for their role. Frontend communicates exclusively via backend REST endpoints (no direct database or storage credentials on the frontend). Database schema modifications must use incremental Flyway migrations with soft-delete support.

## Acceptance Criteria

### Backend & API Verification
- [ ] Flyway migration applies cleanly with Hibernate `ddl-auto=validate` passing on startup.
- [ ] Endpoints `/api/admin/textbooks`, `/api/admin/textbooks/{id}`, `/api/admin/textbooks/{id}/publish`, and `/api/admin/textbooks/{id}/hide` are accessible only to authorized Admins and return 401/403 for unauthorized/unauthenticated requests.
- [ ] Catalog endpoints `GET /api/textbooks` and `GET /api/textbooks/{id}/open` return only published textbooks to Student/Teacher roles, correctly calculating `pdfPage` based on requested `bookPage` and `base_page_offset`.
- [ ] `mvn clean test` (or backend test suite) executes with 0 failures.

### Frontend Quality & Build Verification
- [ ] `npm run build` completes successfully with 0 TypeScript/compilation errors.
- [ ] `npm run lint` completes with 0 errors.
- [ ] Textbook catalog and reader views render in Admin, Teacher, and Student navigation without broken routes or hardcoded select options.

### End-to-End Automated Script Verification
- [ ] An automated staging test script (e.g. `scripts/staging-textbook-e2e.ps1`) runs against the backend, verifying Admin textbook creation, publish toggle, Student query, offset calculation in `/open`, and unauthorized rejection with 100% assertions passing.
