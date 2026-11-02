# MATH10 Backend Architecture Survey & Technical Plan: Textbook Management

**Author**: explorer_backend_survey_1 (Backend Architecture Explorer)  
**Date**: 2026-09-13  
**Status**: Comprehensive Assessment & Implementation Blueprint  
**Target Module**: Textbook Catalog & PDF Reading System (`/api/admin/textbooks`, `/api/textbooks`)

---

## 1. Executive Summary

This investigation analyzed the backend architecture of the MATH10 platform located at `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/math10-backend`. The backend is a production-grade Spring Boot 3.3.5 modular monolith targeting Java 17, using Spring Data JPA, PostgreSQL (Neon cloud in staging, Zonky embedded PostgreSQL in tests), Flyway for database migrations, Cloudflare R2 (S3-compatible API) for file storage, and Spring Security with stateless JWT for role-based access control.

### Core Survey Findings:
1. **Flyway Migration Versioning**: Exactly 76 migrations currently exist in `src/main/resources/db/migration`. The latest migration is `V202609131300__fix_lesson_documents_and_seed_bai_1_menh_de.sql`. The next migration must follow the format `V202609131400__<description>.sql`.
2. **Current Textbook Schema State**: Baseline textbook columns (`status`, `subject_id`, `total_pages`, `base_page_offset`) and table `document_page_mappings` were already introduced in `V202607310000__add_textbook_fields_and_page_mapping.sql`. However, there are **no seed textbooks** in migrations, and composite indexes for catalog filtering by grade and subject can be optimized.
3. **Endpoint Architecture Gap**: 
   - Acceptance criteria in `ORIGINAL_REQUEST.md` and `MATH10_MASTER_PLAN.md` require endpoints at `/api/admin/textbooks/**` (Admin-only) and `/api/textbooks/**` (Teacher/Student/Admin catalog).
   - Currently, textbook endpoints exist under `/api/admin/documents/textbooks` and `/api/documents/textbooks` with incomplete role isolation (e.g. `listTextbooks` in `AdminDocumentController` permitted `TEACHER`).
   - Additionally, `openTextbook` was implemented as `POST /api/documents/textbooks/{id}/open` rather than `GET /api/textbooks/{id}/open`.
   - `DELETE /api/admin/textbooks/{id}` (soft-delete) does not yet exist.
4. **Test Infrastructure**: Tests run against real PostgreSQL using `io.zonky.test:embedded-database-spring-test` (v16.14.0 Windows binary) with zero external network or staging database dependency. Surefire guarantees test isolation via `MATH10_ENV_FILE=khong-nap-env-khi-chay-test`. Verified test execution passed in 12–14 seconds.
5. **PDF Page Offset Calculation**: Physical book page $1$ corresponds to PDF page `base_page_offset`. The formula `pdfPage = bookPage + (base_page_offset - 1)` is already implemented in `DocumentServiceImpl#resolvePdfPage` and correctly resolves 1-based page offsets.

---

## 2. Technology Stack & Build Configuration

### 2.1 Project Metadata
- **Location**: `math10-backend/`
- **Build System**: Apache Maven (`pom.xml`)
- **Java Version**: `17` (`<java.version>17</java.version>`)
- **Spring Boot Version**: `3.3.5`
- **Artifact**: `com.math10:math10-backend:0.1.0-SNAPSHOT`

### 2.2 Key Dependencies
| Dependency | Version / Source | Purpose |
|------------|------------------|---------|
| `org.springframework.boot:spring-boot-starter-web` | 3.3.5 | REST APIs, Jackson, Tomcat |
| `org.springframework.boot:spring-boot-starter-data-jpa` | 3.3.5 | Hibernate 6.5+, Spring Data JPA |
| `org.springframework.boot:spring-boot-starter-security` | 3.3.5 | Spring Security 6.3+ |
| `org.springframework.boot:spring-boot-starter-validation` | 3.3.5 | Jakarta Bean Validation |
| `org.postgresql:postgresql` | Runtime | PostgreSQL JDBC driver |
| `org.flywaydb:flyway-core` & `flyway-database-postgresql` | Managed | Incremental SQL migrations |
| `software.amazon.awssdk:s3` | 2.25.16 (BOM) | S3 SDK for Cloudflare R2 object storage |
| `org.apache.pdfbox:pdfbox` | 3.0.3 | PDF page extraction and rendering |
| `org.springdoc:springdoc-openapi-starter-webmvc-ui` | 2.6.0 | OpenAPI 3.0 specification & Swagger UI |
| `org.projectlombok:lombok` | 1.18.34 | Boilerplate reduction |
| `io.zonky.test:embedded-database-spring-test` | 2.8.0 | Embedded real PostgreSQL for JUnit 5 tests |
| `io.zonky.test:embedded-postgres` | 2.2.2 | Embedded postgres runner |
| `io.zonky.test.postgres:embedded-postgres-binaries-windows-amd64` | 16.14.0 | Windows PostgreSQL 16 binaries |

### 2.3 Package Architecture
The backend uses a modular monolith package pattern under `com.math10`:
```
com.math10/
├── Math10BackendApplication.java    # @SpringBootApplication, @EnableJpaAuditing, @EnableMethodSecurity
├── admin/                           # System administration & stats
├── assignments/                     # Homework & assignment distribution
├── audit/                           # Audit trail & logging
├── authentication/                  # Login, refresh token, password management
├── common/                          # BaseEntity, ApiResponse, GlobalExceptionHandler, StorageService
│   ├── dto/                         # Common ApiResponse<T>
│   ├── entity/                      # BaseEntity (deleted_at, created_at, updated_at)
│   ├── exception/                   # GlobalExceptionHandler, BusinessException, ResourceNotFoundException
│   └── storage/                     # StorageService, R2StorageServiceImpl, StorageUrlSupport
├── configuration/                   # SecurityConfig, JwtService, JwtAuthenticationFilter, Math10Principal
├── documents/                       # Documents, Textbooks, Lesson Documents
│   ├── controller/                  # AdminDocumentController, DocumentController, etc.
│   ├── dto/                         # Textbook DTOs (List, Detail, Open, Upload)
│   ├── entity/                      # Document, DocumentPageMapping, DocumentStatus, DocumentType
│   ├── repository/                  # DocumentRepository, DocumentPageMappingRepository
│   ├── service/                     # DocumentService, PdfThumbnailService, LearningPackageService
│   └── support/                     # DocumentUrls, FileFormatDetector
├── files/                           # File assets, download streaming
├── grades/                          # Grades entity & repository (GRADE_10)
├── subjects/                        # Subjects entity & repository (MATH)
└── users/                           # Users, accounts, roles
```

---

## 3. Database Architecture & Migrations

### 3.1 Migration Environment & Convention
- **Directory**: `math10-backend/src/main/resources/db/migration/`
- **Naming Convention**: `V<YYYYMMDDHHMM>__<snake_case_description>.sql`
- **Latest Migration File**: `V202609131300__fix_lesson_documents_and_seed_bai_1_menh_de.sql`
- **Next Migration File**: `V202609131400__align_textbook_schema_and_seed.sql`
- **Application Configuration (`application.yml`)**:
  - `spring.jpa.hibernate.ddl-auto: validate` (Hibernate strictly validates entity mappings against PostgreSQL schema; any mismatched column name or type will fail application startup).
  - `spring.flyway.locations: classpath:db/migration`
  - `spring.flyway.out-of-order: true`

### 3.2 Current Textbook Database Schema
1. **`documents` Table**:
   - `id`: `bigserial primary key`
   - `title`: `varchar(255) not null`
   - `doc_type`: `varchar(30) not null` (`SGK`, `SBT`, `KHBD`, `VIDEO`, `DE_THI`)
   - `audience`: `varchar(30) not null` (`TEACHER_ONLY`, `STUDENT_ALLOWED`)
   - `status`: `varchar(30) not null default 'DRAFT'` (`DRAFT`, `PUBLISHED`, `HIDDEN`)
   - `file_url`: `varchar(1024) not null`
   - `thumbnail_url`: `varchar(1024)`
   - `grade_id`: `bigint references grades(id)`
   - `subject_id`: `bigint references subjects(id)`
   - `total_pages`: `int`
   - `base_page_offset`: `int not null default 1`
   - `content_markdown`: `text`
   - `created_at`: `timestamp not null default now()`
   - `updated_at`: `timestamp not null default now()`
   - `deleted_at`: `timestamp` (Soft delete column)

2. **`document_page_mappings` Table**:
   - `id`: `bigserial primary key`
   - `document_id`: `bigint not null references documents(id)`
   - `pdf_page_number`: `int not null`
   - `book_page_label`: `varchar(30)`
   - `page_type`: `varchar(30) default 'CONTENT'` (`COVER`, `TABLE_OF_CONTENTS`, `CONTENT`, `APPENDIX`, `BLANK`)
   - `chapter_title`: `varchar(255)`
   - `lesson_title`: `varchar(255)`
   - `created_at`, `updated_at`, `deleted_at`
   - `constraint uq_document_pdf_page unique (document_id, pdf_page_number)`

### 3.3 Soft Delete Convention
- All domain tables include `deleted_at timestamp NULL`.
- Java entities extend `com.math10.common.entity.BaseEntity`, which defines:
  ```java
  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  public void markDeleted() {
      this.deletedAt = LocalDateTime.now();
  }
  ```
- Entities use Hibernate 6 `@SQLRestriction("deleted_at IS NULL")`.
- When soft-deleting a textbook, `textbook.markDeleted()` is invoked and saved via JPA, automatically excluding it from all standard Spring Data JPA queries.

### 3.4 Next Flyway Migration Script: `V202609131400__align_textbook_schema_and_seed.sql`
The next migration needs to:
1. Ensure composite indexing for catalog filtering by `(doc_type, status, grade_id, subject_id)`.
2. Seed baseline sample textbooks for Grade 10 Math (SGK Tập 1, SBT Tập 1, SGK Tập 2) with known page offsets so automated acceptance tests and frontend views have predictable data.

```sql
-- ============================================================
-- V202609131400__align_textbook_schema_and_seed.sql
-- Hoàn thiện chỉ mục và nạp dữ liệu mẫu SGK/SBT Lớp 10
-- ============================================================

-- 1. Thêm chỉ mục tối ưu cho truy vấn danh mục Sách giáo khoa
create index if not exists idx_documents_textbook_catalog
    on documents(doc_type, status, grade_id, subject_id)
    where deleted_at is null;

-- 2. Đảm bảo môn TOÁN và khối 10 tồn tại
insert into subjects (code, name, created_at, updated_at)
select 'MATH', 'Toán học', now(), now()
where not exists (select 1 from subjects where code = 'MATH' and deleted_at is null);

insert into grades (code, grade_number, name, created_at, updated_at)
select 'GRADE_10', 10, 'Lớp 10', now(), now()
where not exists (select 1 from grades where code = 'GRADE_10' and deleted_at is null);

-- 3. Nạp tài liệu mẫu SGK / SBT Toán 10 (chỉ nạp nếu chưa có)
do $$
declare
    v_grade_10_id bigint;
    v_math_id bigint;
    v_sgk_id bigint;
begin
    select id into v_grade_10_id from grades where code = 'GRADE_10' and deleted_at is null limit 1;
    select id into v_math_id from subjects where code = 'MATH' and deleted_at is null limit 1;

    -- Sách giáo khoa Toán 10 - Tập 1 (Đã xuất bản, Offset = 5)
    if not exists (select 1 from documents where title = 'Sách giáo khoa Toán 10 - Tập 1 (Kết nối tri thức)' and deleted_at is null) then
        insert into documents (
            title, doc_type, audience, status, file_url, thumbnail_url,
            grade_id, subject_id, total_pages, base_page_offset, file_format, created_at, updated_at
        ) values (
            'Sách giáo khoa Toán 10 - Tập 1 (Kết nối tri thức)',
            'SGK', 'STUDENT_ALLOWED', 'PUBLISHED',
            '/api/documents/content/seed-sgk-toan-10-t1.pdf',
            '/api/documents/content/seed-sgk-toan-10-t1-thumb.png',
            v_grade_10_id, v_math_id, 120, 5, 'PDF', now(), now()
        ) returning id into v_sgk_id;

        -- Tạo mẫu page mapping cho bìa và mục lục
        insert into document_page_mappings (document_id, pdf_page_number, book_page_label, page_type, chapter_title, lesson_title, created_at, updated_at)
        values
        (v_sgk_id, 1, 'Bìa', 'COVER', null, null, now(), now()),
        (v_sgk_id, 2, 'Lời nói đầu', 'COVER', null, null, now(), now()),
        (v_sgk_id, 3, 'Mục lục 1', 'TABLE_OF_CONTENTS', null, null, now(), now()),
        (v_sgk_id, 4, 'Mục lục 2', 'TABLE_OF_CONTENTS', null, null, now(), now()),
        (v_sgk_id, 5, 'Trang 1', 'CONTENT', 'Chương I. Mệnh đề và tập hợp', 'Bài 1. Mệnh đề', now(), now());
    end if;

    -- Sách bài tập Toán 10 - Tập 1 (Đã xuất bản, Offset = 3)
    if not exists (select 1 from documents where title = 'Sách bài tập Toán 10 - Tập 1 (Kết nối tri thức)' and deleted_at is null) then
        insert into documents (
            title, doc_type, audience, status, file_url, thumbnail_url,
            grade_id, subject_id, total_pages, base_page_offset, file_format, created_at, updated_at
        ) values (
            'Sách bài tập Toán 10 - Tập 1 (Kết nối tri thức)',
            'SBT', 'STUDENT_ALLOWED', 'PUBLISHED',
            '/api/documents/content/seed-sbt-toan-10-t1.pdf',
            '/api/documents/content/seed-sbt-toan-10-t1-thumb.png',
            v_grade_10_id, v_math_id, 96, 3, 'PDF', now(), now()
        );
    end if;

    -- Sách giáo khoa Toán 10 - Tập 2 (Bản nháp DRAFT, Offset = 5)
    if not exists (select 1 from documents where title = 'Sách giáo khoa Toán 10 - Tập 2 (Kết nối tri thức)' and deleted_at is null) then
        insert into documents (
            title, doc_type, audience, status, file_url, thumbnail_url,
            grade_id, subject_id, total_pages, base_page_offset, file_format, created_at, updated_at
        ) values (
            'Sách giáo khoa Toán 10 - Tập 2 (Kết nối tri thức)',
            'SGK', 'STUDENT_ALLOWED', 'DRAFT',
            '/api/documents/content/seed-sgk-toan-10-t2.pdf',
            '/api/documents/content/seed-sgk-toan-10-t2-thumb.png',
            v_grade_10_id, v_math_id, 112, 5, 'PDF', now(), now()
        );
    end if;
end $$;
```

---

## 4. Security Architecture & RBAC

### 4.1 Spring Security & JWT Mechanism
- **Filter**: `JwtAuthenticationFilter` intercepts HTTP requests before `UsernamePasswordAuthenticationFilter`.
- **Bearer Token Extraction**: Reads `Authorization: Bearer <token>`.
- **Authority Assignment**: Extracts `principal.roleCode()` and assigns authority `ROLE_<roleCode>` (e.g., `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT`).
- **Principal Object**: `com.math10.configuration.security.Math10Principal(Long userId, String email, String roleCode)`.
- **Method Security**: `@EnableMethodSecurity` is enabled on `Math10BackendApplication`.
- **Access Denied Handling**: `GlobalExceptionHandler` intercepts `AccessDeniedException` and outputs:
  ```json
  {
    "success": false,
    "code": 403,
    "message": "Bạn không có quyền thực hiện thao tác này",
    "data": null
  }
  ```

### 4.2 Endpoint Authorization Rules Specification

| Route Pattern | Method | Permitted Roles | Business Authorization & Response Codes |
|---|---|---|---|
| `/api/admin/textbooks` | `GET` | `ROLE_ADMIN` | Returns all textbooks (DRAFT, PUBLISHED, HIDDEN). Unauthenticated $\to$ 401/403; Teacher/Student $\to$ 403. |
| `/api/admin/textbooks` | `POST` | `ROLE_ADMIN` | Creates new textbook record or uploads PDF file. Returns 201 Created. Unauthorized $\to$ 403. |
| `/api/admin/textbooks/{id}` | `GET` | `ROLE_ADMIN` | Returns full textbook detail including page mappings. If not found $\to$ 404; Unauthorized $\to$ 403. |
| `/api/admin/textbooks/{id}` | `PUT` | `ROLE_ADMIN` | Updates textbook metadata & offset. Returns 200 OK. Unauthorized $\to$ 403. |
| `/api/admin/textbooks/{id}/publish` | `PATCH` | `ROLE_ADMIN` | Sets status = `PUBLISHED`. Returns 200 OK. Unauthorized $\to$ 403. |
| `/api/admin/textbooks/{id}/hide` | `PATCH` | `ROLE_ADMIN` | Sets status = `HIDDEN`. Returns 200 OK. Unauthorized $\to$ 403. |
| `/api/admin/textbooks/{id}` | `DELETE` | `ROLE_ADMIN` | Soft-deletes record (`markDeleted()`). Returns 204 NoContent. Unauthorized $\to$ 403. |
| `/api/textbooks` | `GET` | `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT` | Returns only `PUBLISHED` textbooks. For `STUDENT`, filters `audience == STUDENT_ALLOWED`. Optional filters: `gradeId`, `subjectId`. Unauthenticated $\to$ 401/403. |
| `/api/textbooks/{id}` | `GET` | `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT` | Returns published textbook detail. If DRAFT/HIDDEN or student not allowed $\to$ 403 Forbidden. |
| `/api/textbooks/{id}/open` | `GET` & `POST` | `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT` | Computes target PDF page: `pdfPage = bookPage + (base_page_offset - 1)`. Returns `TextbookOpenResponse`. If book not published $\to$ 403. |

---

## 5. Storage, PDF Processing & Offset Calibration

### 5.1 Cloudflare R2 Integration
- Service: `R2StorageServiceImpl` implements `StorageService`.
- Backend acts as security boundary: Frontend does not access S3/R2 directly.
- In `uploadTextbook`, files are sent to `storageService.upload(file, "textbooks")`.
- Thumbnail generation: Uses `PdfThumbnailService.renderFirstPagePng()` with PDFBox to render page 1 at 240px width and uploads PNG to `math10-files/thumbnails`.

### 5.2 PDF Page Count Automation with PDFBox
In the existing implementation, `totalPages` was omitted during textbook upload and defaulted to `null`.
Using PDFBox 3.0.3, `uploadTextbook` can extract the exact PDF page count dynamically:
```java
try (var pdDoc = org.apache.pdfbox.Loader.loadPDF(file.getBytes())) {
    textbook.setTotalPages(pdDoc.getNumberOfPages());
} catch (Exception e) {
    log.warn("Không thể đếm số trang PDF tự động: {}", e.getMessage());
}
```

### 5.3 Page Offset Calibration Formula
- **Concept**: Physical book page 1 often does not align with PDF file page 1 due to front matter (front cover, praise, publisher details, table of contents).
- **Definition**: `base_page_offset` is the 1-indexed PDF page where physical book page 1 appears.
  - Example: If cover is page 1, copyright is page 2, table of contents is pages 3-4, and Chapter 1 (page 1) starts on PDF page 5, then `base_page_offset = 5`.
- **Resolution Formula**:
  $$\text{pdfPage} = \text{bookPage} + (\text{base\_page\_offset} - 1)$$
  - When student navigates to book page 1: $\text{pdfPage} = 1 + (5 - 1) = 5$.
  - When student navigates to book page 10: $\text{pdfPage} = 10 + (5 - 1) = 14$.
- **Boundary Clamping**:
  ```java
  int offset = (doc.getBasePageOffset() != null && doc.getBasePageOffset() > 0) ? doc.getBasePageOffset() : 1;
  int requestedBookPage = (bookPage != null && bookPage > 0) ? bookPage : 1;
  int calculatedPdfPage = requestedBookPage + (offset - 1);
  if (doc.getTotalPages() != null && calculatedPdfPage > doc.getTotalPages()) {
      calculatedPdfPage = doc.getTotalPages();
  }
  ```

---

## 6. Testing Framework & Staging Script Conventions

### 6.1 Backend Test Architecture
- Framework: JUnit 5 (`org.junit.jupiter.api.*`) + AssertJ + MockMvc.
- PostgreSQL Test Provider: `io.zonky.test.db.AutoConfigureEmbeddedDatabase(provider = ZONKY)`.
- Isolation: `maven-surefire-plugin` injects `MATH10_ENV_FILE=khong-nap-env-khi-chay-test`, preventing staging environment variables from contaminating integration tests.
- Mocking: Mockito 5 for isolated unit tests (`@ExtendWith(MockitoExtension.class)`).
- Running tests command:
  ```powershell
  mvn test -Dtest=AdminTextbookControllerTest,TextbookControllerTest,TextbookOffsetServiceTest
  ```

### 6.2 Staging Script Conventions (`scripts/*.ps1`)
All staging scripts follow these standard patterns:
1. Load credentials from `.env.staging` (or `.admin-staging-credentials.txt`).
2. Login through `POST http://localhost:8080/api/auth/login` to obtain access tokens for Admin, Teacher, and Student.
3. Use helper function `Api([string]$Method, [string]$Path, [string]$Token, $Body)` with `Authorization: Bearer <Token>`.
4. Use helper function `IsForbidden([scriptblock]$Request)` to assert HTTP 403 responses.
5. Create unique resource names using `[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()`.
6. Validate all states: Create $\to$ Publish $\to$ Query as Student $\to$ Open with Offset $\to$ Hide $\to$ Assert Forbidden for Student $\to$ Soft-delete.

---

## 7. Detailed Backend Technical Implementation Plan

### 7.1 Database Migration
- **File**: `math10-backend/src/main/resources/db/migration/V202609131400__align_textbook_schema_and_seed.sql`
- **Actions**:
  1. Add partial index `idx_documents_textbook_catalog` on `documents(doc_type, status, grade_id, subject_id) where deleted_at is null`.
  2. Idempotently insert baseline Grade 10 textbooks:
     - SGK Toán 10 Tập 1 (`PUBLISHED`, `offset=5`, `totalPages=120`) + 5 sample `document_page_mappings`.
     - SBT Toán 10 Tập 1 (`PUBLISHED`, `offset=3`, `totalPages=96`).
     - SGK Toán 10 Tập 2 (`DRAFT`, `offset=5`, `totalPages=112`).

### 7.2 Controller Classes to Create/Modify
1. **`com.math10.documents.controller.AdminTextbookController`** (New):
   - Path: `@RequestMapping("/api/admin/textbooks")`
   - Security: `@PreAuthorize("hasRole('ADMIN')")`
   - Endpoints:
     - `GET ""` $\to$ `listAllTextbooks()`
     - `GET "/{id}"` $\to$ `getTextbook(id)`
     - `POST ""` (consumes `multipart/form-data`) $\to$ `uploadTextbook(...)`
     - `POST ""` (consumes `application/json`) $\to$ `createTextbook(...)` (enables script and automated API testing without binary upload)
     - `PUT "/{id}"` $\to$ `updateTextbook(id, request)`
     - `PATCH "/{id}/publish"` $\to$ `publishTextbook(id)`
     - `PATCH "/{id}/hide"` $\to$ `hideTextbook(id)`
     - `DELETE "/{id}"` $\to$ `deleteTextbook(id)` (soft delete)

2. **`com.math10.documents.controller.TextbookController`** (New):
   - Path: `@RequestMapping("/api/textbooks")`
   - Security: `@PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")`
   - Endpoints:
     - `GET ""` $\to$ `listTextbooks(@RequestParam(required=false) Long gradeId, @RequestParam(required=false) Long subjectId)`
     - `GET "/{id}"` $\to$ `getTextbookCatalogDetail(id)` (verifies published & student audience)
     - `GET "/{id}/open"` & `POST "/{id}/open"` $\to$ `openTextbook(id, bookPage)` (returns `TextbookOpenResponse` with calibrated `pdfPage`)

3. **Backwards Compatibility**:
   - Keep existing mapping methods in `AdminDocumentController` (`/api/admin/documents/textbooks/**`) and `DocumentController` (`/api/documents/textbooks/**`) delegating to the same `DocumentService` methods so existing frontend components or legacy callers continue to function without disruption.

### 7.3 DTO Classes to Create/Modify
1. **`TextbookCreateRequest.java`** (New):
   ```java
   public record TextbookCreateRequest(
       @NotBlank String title,
       @NotNull DocumentType docType,
       @NotNull DocumentAudience audience,
       Long gradeId,
       Long subjectId,
       @NotBlank String fileUrl,
       String thumbnailUrl,
       @Min(1) Integer totalPages,
       @Min(1) Integer basePageOffset,
       DocumentStatus status
   ) {}
   ```
2. **`TextbookUpdateRequest.java`** (or reuse `DocumentUpdateRequest`):
   Support updating title, docType, audience, gradeId, subjectId, totalPages, basePageOffset, status.
3. **`TextbookOpenResponse.java`** (Existing, verified):
   `record TextbookOpenResponse(Long documentId, String title, String fileUrl, Integer pdfPage, Integer totalPages)`

### 7.4 Service Enhancements in `DocumentService` & `DocumentServiceImpl`
1. Add `TextbookListResponse createTextbook(TextbookCreateRequest request);`
2. Add `void deleteTextbook(Long id);` (verifies docType is SGK/SBT, records audit log, calls `markDeleted()`).
3. Enhance `uploadTextbook`:
   - Set status to `DRAFT` by default (or accept status).
   - Use PDFBox to automatically read `totalPages` from `file.getBytes()`.
4. Enhance `openTextbook`:
   - If book status is not `PUBLISHED` $\to$ throw `AccessDeniedException("Sách này chưa được xuất bản")`.
   - If user is `STUDENT` and audience is not `STUDENT_ALLOWED` $\to$ throw `AccessDeniedException("Bạn không có quyền đọc sách này")`.
   - Calculate `pdfPage`:
     $$\text{pdfPage} = \text{Math.max}(1, \text{requestedPage} + (\text{basePageOffset} - 1))$$
   - Clamp to `totalPages` if totalPages is present.

### 7.5 Automated Tests to Write
1. **Unit Tests**:
   - `com.math10.documents.service.impl.TextbookOffsetTest` (Unit test verifying page offset calculation with edge cases: page 1, page 10, offset 1, offset 5, out-of-bounds page clamping, null handling).
2. **Integration Tests (MockMvc + Zonky Embedded Postgres)**:
   - `com.math10.documents.controller.AdminTextbookControllerTest`:
     - Test 1: Admin can create/upload textbook with offset $\to$ 201 Created.
     - Test 2: Teacher/Student calling `/api/admin/textbooks` receives 403 Forbidden.
     - Test 3: Unauthenticated request receives 401/403.
     - Test 4: Admin can toggle publish and hide $\to$ status changes verified in database.
     - Test 5: Admin can soft-delete textbook $\to$ `deleted_at` is set, textbook disappears from list.
   - `com.math10.documents.controller.TextbookControllerTest`:
     - Test 1: Student queries `GET /api/textbooks` $\to$ only sees `PUBLISHED` textbooks with `STUDENT_ALLOWED`.
     - Test 2: Student opens published textbook with `bookPage=10` and `base_page_offset=5` $\to$ receives `pdfPage=14`.
     - Test 3: Student attempts to open `DRAFT` or `HIDDEN` textbook $\to$ receives 403 Forbidden.
     - Test 4: Teacher can browse all published textbooks.

### 7.6 Staging E2E Script: `scripts/staging-textbook-e2e.ps1`
Create an automated staging validation script verifying:
1. Admin login $\to$ Create textbook (DRAFT, offset = 5, totalPages = 100).
2. Student login $\to$ Query `GET /api/textbooks` $\to$ confirms draft textbook is not visible.
3. Admin publishes textbook $\to$ `PATCH /api/admin/textbooks/{id}/publish`.
4. Student queries `GET /api/textbooks` $\to$ textbook is visible.
5. Student calls `GET /api/textbooks/{id}/open?bookPage=1` $\to$ asserts `pdfPage == 5`.
6. Student calls `GET /api/textbooks/{id}/open?bookPage=10` $\to$ asserts `pdfPage == 14`.
7. Teacher token calling `POST /api/admin/textbooks` $\to$ asserts 403 Forbidden.
8. Unauthenticated request to `/api/admin/textbooks` $\to$ asserts 401/403.
9. Admin hides textbook $\to$ `PATCH /api/admin/textbooks/{id}/hide`.
10. Student calls `GET /api/textbooks/{id}/open` $\to$ asserts 403 Forbidden.
11. Admin deletes textbook $\to$ `DELETE /api/admin/textbooks/{id}` $\to$ asserts 204.
12. Script prints `ALL_TEXTBOOK_STAGING_TESTS_PASSED`.

---

## 8. Summary of File Changes for Implementation

| Action | File Path | Scope |
|---|---|---|
| **Create** | `math10-backend/src/main/resources/db/migration/V202609131400__align_textbook_schema_and_seed.sql` | Migration script with catalog index and seed data |
| **Create** | `math10-backend/src/main/java/com/math10/documents/controller/AdminTextbookController.java` | Admin textbook REST endpoints (`/api/admin/textbooks`) |
| **Create** | `math10-backend/src/main/java/com/math10/documents/controller/TextbookController.java` | Public catalog & reader REST endpoints (`/api/textbooks`) |
| **Create** | `math10-backend/src/main/java/com/math10/documents/dto/TextbookCreateRequest.java` | DTO for programmatic/JSON textbook creation |
| **Modify** | `math10-backend/src/main/java/com/math10/documents/service/DocumentService.java` | Interface signatures for textbook deletion and JSON creation |
| **Modify** | `math10-backend/src/main/java/com/math10/documents/service/impl/DocumentServiceImpl.java` | Implementation of deletion, creation, PDFBox page count, and offset |
| **Create** | `math10-backend/src/test/java/com/math10/documents/controller/AdminTextbookControllerTest.java` | Integration tests for Admin textbook endpoints |
| **Create** | `math10-backend/src/test/java/com/math10/documents/controller/TextbookControllerTest.java` | Integration tests for catalog and reader endpoints |
| **Create** | `math10-backend/src/test/java/com/math10/documents/service/impl/TextbookOffsetTest.java` | Unit tests for offset calculation logic |
| **Create** | `scripts/staging-textbook-e2e.ps1` | Automated PowerShell staging acceptance test script |
