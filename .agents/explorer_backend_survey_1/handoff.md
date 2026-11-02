# Handoff Report: Backend Architecture Survey & Textbook Technical Plan

**Agent**: explorer_backend_survey_1 (Backend Architecture Explorer)  
**Parent Conversation ID**: 50a935d1-4f71-4466-94a3-0d6d3d36d038  
**Working Directory**: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_backend_survey_1/`  
**Date**: 2026-09-13  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Build & Runtime Configuration**:
   - `math10-backend/pom.xml:14-15`:
     ```xml
     <java.version>17</java.version>
     <spring-boot.version>3.3.5</spring-boot.version>
     ```
   - `math10-backend/pom.xml:57-60`: PDFBox version `3.0.3` is declared.
   - `math10-backend/pom.xml:129-149`: Test PostgreSQL binary is managed by `io.zonky.test:embedded-database-spring-test:2.8.0` and `io.zonky.test.postgres:embedded-postgres-binaries-windows-amd64:16.14.0`.
   - `math10-backend/pom.xml:186-188`: Surefire sets `<systemPropertyVariables><MATH10_ENV_FILE>khong-nap-env-khi-chay-test</MATH10_ENV_FILE></systemPropertyVariables>`.

2. **Flyway Migrations**:
   - Migration directory: `math10-backend/src/main/resources/db/migration/` contains exactly 76 migrations.
   - Latest migration: `V202609131300__fix_lesson_documents_and_seed_bai_1_menh_de.sql`.
   - Existing textbook schema is in `V202607310000__add_textbook_fields_and_page_mapping.sql:8-31`:
     - `documents` table has `status varchar(30) not null default 'DRAFT'`, `subject_id bigint references subjects(id)`, `total_pages int`, `base_page_offset int not null default 1`.
     - `document_page_mappings` table has `uq_document_pdf_page unique (document_id, pdf_page_number)`.
   - No seed textbook records exist in any Flyway migration file.

3. **Entity and Soft Delete Mapping**:
   - `com.math10.documents.entity.Document.java:21-23`:
     ```java
     @Entity
     @Table(name = "documents")
     @SQLRestriction("deleted_at IS NULL")
     public class Document extends BaseEntity
     ```
   - `com.math10.common.entity.BaseEntity.java:35-40`:
     ```java
     @Column(name = "deleted_at")
     private LocalDateTime deletedAt;
     public void markDeleted() { this.deletedAt = LocalDateTime.now(); }
     ```

4. **Security & RBAC**:
   - `com.math10.Math10BackendApplication.java:10`: `@EnableMethodSecurity`.
   - `com.math10.configuration.security.JwtAuthenticationFilter.java:33`: Granted authority is constructed as `new SimpleGrantedAuthority("ROLE_" + principal.roleCode())` (values: `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT`).
   - `com.math10.configuration.security.SecurityConfig.java:52-61`: Filter chain sets `.anyRequest().authenticated()`.
   - `com.math10.common.exception.GlobalExceptionHandler.java:52-56`: Catches `AccessDeniedException` and returns HTTP 403.

5. **Existing Endpoints vs Requirements**:
   - `ORIGINAL_REQUEST.md:27-28`: Specifies endpoints `/api/admin/textbooks`, `/api/admin/textbooks/{id}`, `/api/admin/textbooks/{id}/publish`, `/api/admin/textbooks/{id}/hide`, `GET /api/textbooks`, and `GET /api/textbooks/{id}/open`.
   - In existing code:
     - `AdminDocumentController.java:31,148-193`: Class is mapped to `@RequestMapping("/api/admin/documents")`, meaning textbook routes are `/api/admin/documents/textbooks/**`. Additionally, `listTextbooks` uses `@PreAuthorize("hasAnyRole('ADMIN','TEACHER')")` instead of Admin-only.
     - `DocumentController.java:27,118-141`: Class is mapped to `@RequestMapping("/api/documents")`. Endpoint `/textbooks/{id}/open` is mapped as `@PostMapping` rather than `GET` (or both).
     - No soft-delete endpoint `DELETE /api/admin/textbooks/{id}` currently exists.

6. **Test Verification Command**:
   - Running `mvn test -Dtest=DocumentAccessTest` exited with code 0 (`Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.558 s`).
   - Running `mvn test -Dtest=*Document*Test` exited with code 0 (`Tests run: 24, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.067 s`).

---

## 2. Logic Chain

1. **Schema & Migration Versioning**:
   - From Observation 2, the latest migration is timestamped `202609131300`. Following Flyway's chronological naming standard, the next migration must be named `V202609131400__align_textbook_schema_and_seed.sql`.
   - Because `documents` already contains the needed columns from `V202607310000`, the next migration must add a composite index `idx_documents_textbook_catalog` on `(doc_type, status, grade_id, subject_id)` and seed baseline textbooks (`PUBLISHED` and `DRAFT`) with sample page mappings to fulfill R1 and R2.

2. **Endpoint Separation and Role-Based Access Control**:
   - From Observation 5, the acceptance criteria explicitly mandate `/api/admin/textbooks/**` (Admin-only) and `/api/textbooks/**` (Teacher/Student/Admin catalog).
   - The current codebase placed them under `/api/admin/documents/textbooks` and `/api/documents/textbooks`.
   - Therefore, new dedicated controllers `AdminTextbookController` (`@RequestMapping("/api/admin/textbooks")`, `@PreAuthorize("hasRole('ADMIN')")`) and `TextbookController` (`@RequestMapping("/api/textbooks")`) must be introduced.
   - For backwards compatibility, existing routes in `AdminDocumentController` and `DocumentController` should remain, delegating to the same underlying service.

3. **Page Offset Calibration & Reader Logic**:
   - From `ORIGINAL_REQUEST.md:18`, navigation to physical `bookPage` calculates `pdfPage = bookPage + (base_page_offset - 1)`.
   - `DocumentServiceImpl#resolvePdfPage` already uses `basePageOffset + bookPage - 1`.
   - Supporting both `GET` and `POST` on `/api/textbooks/{id}/open` allows query parameter `?bookPage=10` per the spec while keeping compatibility with any POST callers.
   - For students, if `status != PUBLISHED` or `audience != STUDENT_ALLOWED`, `AccessDeniedException` must be thrown, triggering 403 Forbidden per Observation 4.

4. **Soft-Delete Implementation**:
   - From Observation 3, `Document` extends `BaseEntity` with `@SQLRestriction("deleted_at IS NULL")`.
   - Introducing `DELETE /api/admin/textbooks/{id}` that invokes `document.markDeleted()` satisfies R1 ("soft-deleting records") and ensures the record immediately vanishes from active queries while retaining historical mappings.

---

## 3. Caveats

1. **Storage Mocking in Offline Tests**: Production uploads go to Cloudflare R2 (`R2StorageServiceImpl`). In tests, either Mockito mocks `StorageService` or endpoints accept pre-existing `fileUrl` strings (via JSON `TextbookCreateRequest`) so test runners without S3 credentials execute reliably.
2. **Existing Frontend Endpoints**: The frontend code in `src/api.ts` currently calls `/api/admin/documents/textbooks` and `/api/documents/textbooks`. Keeping backwards-compatible alias methods in `AdminDocumentController` and `DocumentController` avoids breaking legacy UI until frontend update is executed.
3. **No caveats** regarding database compatibility: Zonky embedded PostgreSQL 16 matches PostgreSQL staging, and `ddl-auto=validate` will verify all entity annotations against the migration schema.

---

## 4. Conclusion

The MATH10 backend has a solid foundation for textbook management. The required implementation requires:
1. One incremental Flyway migration (`V202609131400__align_textbook_schema_and_seed.sql`) adding composite catalog indexing and seed Grade 10 textbooks.
2. Two new dedicated controllers:
   - `AdminTextbookController` at `/api/admin/textbooks` (CRUD, publish, hide, soft-delete, strictly Admin-only).
   - `TextbookController` at `/api/textbooks` (catalog query, book detail, `/open` endpoint with offset calibration).
3. DTO enhancements (`TextbookCreateRequest`, `TextbookUpdateRequest`).
4. Service additions in `DocumentService`/`DocumentServiceImpl` (`deleteTextbook`, `createTextbook`, dynamic PDF page count via PDFBox).
5. Comprehensive test coverage: unit tests (`TextbookOffsetTest`), integration tests (`AdminTextbookControllerTest`, `TextbookControllerTest`), and automated staging script (`scripts/staging-textbook-e2e.ps1`).

Detailed technical report is written to:  
`c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_backend_survey_1/backend_report.md`.

---

## 5. Verification Method

To verify the observations and conclusions independently:

1. **Verify Migrations & Schema**:
   ```powershell
   Get-ChildItem -Path math10-backend/src/main/resources/db/migration -Filter *.sql | Sort-Object Name | Select-Object -Last 5
   ```
2. **Run Backend Test Suite**:
   ```powershell
   cd math10-backend
   mvn test -Dtest=DocumentAccessTest,DocumentUrlsTest
   ```
3. **Inspect Existing Textbook Code**:
   - `view_file` on `math10-backend/src/main/java/com/math10/documents/service/impl/DocumentServiceImpl.java` (lines 763–945).
   - `view_file` on `math10-backend/src/main/java/com/math10/documents/controller/AdminDocumentController.java` (lines 146–194).
4. **Invalidation Condition**:
   If `mvn test` fails with ddl-auto validation errors or if `V202609131300` is not the latest migration file, the next migration version number or entity mapping must be adjusted.
