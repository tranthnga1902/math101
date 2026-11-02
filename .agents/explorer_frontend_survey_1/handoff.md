# Handoff Report — Frontend Architecture Survey for Textbook Catalog & PDF Reader

**Agent**: Frontend Architecture Explorer  
**Working Directory**: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_frontend_survey_1/`  
**Date**: 2026-09-13  
**Report File**: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_frontend_survey_1/frontend_report.md`  

---

## 1. Observation

1. **Tech Stack & Tooling Baseline**:
   - `package.json` lines 15-41:
     ```json
     "dependencies": {
       "@tanstack/react-query": "^5.101.4",
       "lucide-react": "^1.27.0",
       "pdfjs-dist": "^4.7.76",
       "react": "19.2.6",
       "react-dom": "19.2.6",
       "tailwindcss": "^4.3.3",
       ...
     }
     ```
   - Tool command `npm run build` executed synchronously/asynchronously (`task-22`):
     ```
     vite v7.3.6 building client environment for production...
     ✓ 2096 modules transformed.
     ✓ built in 18.18s
     The command exited with code 0.
     ```
   - Tool command `npm run lint` executed (`task-69`):
     ```
     > eslint . --ignore-pattern dist
     The command exited with code 0.
     ```

2. **Routing & Role Shell Navigation**:
   - `src/App.tsx` lines 220-238: Role routing renders `MainLayout` + `TeacherDashboard` for `role === "teacher"`, `AdminShell` + `AdminDashboard` for `role === "admin"`, and `StudentExperience` for `role === "student"`.
   - `src/App.tsx` line 250 & `src/admin/AdminShell.tsx` line 33: Admin sidebar item `["textbooks", "Sách giáo khoa", GraduationCap]`.
   - `src/App.tsx` line 410 & `src/admin/AdminShell.tsx` line 110: `activeSection === "textbooks"` renders `<TextbookManagement session={session} />`.
   - `src/layout/Sidebar.tsx` lines 22-33: `MAIN_NAV` for Teacher does NOT currently include `teacher-textbooks` (only `teacher-content`).
   - `src/App.tsx` lines 1155-1165: In `teacher-content`, tab `textbooks` renders `<TextbookStudentView session={session}/>`.
   - `src/App.tsx` lines 1214-1218: `activeSection === "teacher-textbooks"` renders `<TextbookStudentView session={session}/>`.
   - `src/student/StudentShell.tsx` line 22: Nav item `{ key: "textbooks", label: "Sách giáo khoa", icon: "auto_stories" }` exists.
   - `src/student/StudentExperience.tsx` lines 202-263: Renders `TextbooksTab` with simple card grid calling `openTextbookInBrowser(session, book.id)`.

3. **Current Textbook Implementations**:
   - `src/admin/TextbookManagement.tsx`:
     - Uses `AdminPage`, `AdminTable`, `AdminEmptyState`, `AdminModal`.
     - Lines 97-126: `UploadBook` modal only has `title` and `file` inputs; hardcodes `docType: "SGK"`, `audience: "STUDENT_ALLOWED"`, `basePageOffset: 1`.
     - Lines 44-54: Table only displays publish button when `book.status !== "PUBLISHED"`; has no button to hide (`hideTextbook`) when `status === "PUBLISHED"`.
     - No "Edit" modal to edit existing textbook metadata.
     - Lines 129-281: Contains an inline `TextbookReader` component using `pdfCore.ts`, but it only displays raw PDF page numbers (`Trang ${page} / ${total}`) and lacks page offset calculation and offset calibration controls.
   - `src/teacher/TextbookBrowser.tsx`:
     - Lines 118-167: Renders `TextbookStudentView` with `TextbookCard`.
     - Missing search input, grade filter, subject filter, and docType filter.
   - `src/student/StudentExperience.tsx`:
     - Lines 202-263: Renders `TextbooksTab`.
     - Missing search, grade/subject filter, and page jump inputs.
     - Calling `openTextbookInBrowser` opens the generic `PdfViewer` (`src/components/PdfViewer.tsx`), which only navigates by raw PDF page number.

4. **PDF Viewer Engine & Offset Calculation**:
   - `src/components/pdfCore.ts` lines 1-100: Robust PDF viewer hooks (`usePdfDocument`, `usePdfPageRender`, `useScrollPages`, `useDragPan`, `useContentSize`).
   - `src/components/PdfScrollPage.tsx` lines 26-35: Lazy canvas rendering with `IntersectionObserver` (`rootMargin: "150% 0px"`).
   - `math10-backend/src/main/java/com/math10/documents/service/impl/DocumentServiceImpl.java` line 970-982:
     ```java
     private int resolvePdfPage(Long documentId, int bookPage, int basePageOffset) {
         return basePageOffset + bookPage - 1;
     }
     ```
     Direct confirmation of the formula `pdfPage = bookPage + (base_page_offset - 1)`.

5. **API Client Layer**:
   - `src/api.ts` lines 870-899:
     - `getTextbooks(s, gradeId?, subjectId?)` calls `/documents/textbooks`
     - `getTextbook(s, id)` calls `/documents/textbooks/${id}`
     - `openTextbook(s, id, bookPage?)` calls `/documents/textbooks/${id}/open` (POST)
     - `getAdminTextbooks(s)` calls `/admin/documents/textbooks`
     - `uploadTextbook(s, x)` calls `/api/admin/documents/textbooks` (POST multipart)
     - `updateTextbook(s, id, x)` calls `/admin/documents/textbooks/${id}` (PUT)
     - `publishTextbook(s, id)` calls `/admin/documents/textbooks/${id}/publish` (PATCH)
     - `hideTextbook(s, id)` calls `/admin/documents/textbooks/${id}/hide` (PATCH)
     - Soft delete currently uses `deleteDocument(s, id)` targeting `/admin/documents/${id}`.

---

## 2. Logic Chain

1. **Baseline Stability**: Observations 1.1 - 1.3 show `npm run build` and `npm run lint` pass with 0 errors. Any frontend modifications must strictly maintain 0 compilation and lint errors.
2. **Role Navigation Gaps**:
   - Observation 2 shows Admin has menu `textbooks` and Student has tab `textbooks`.
   - However, Teacher sidebar (`src/layout/Sidebar.tsx`) lacks a direct 1st-level `teacher-textbooks` link, forcing teachers into `teacher-content` sub-tab `textbooks`. Adding `teacher-textbooks` into `MAIN_NAV` satisfies MATH10 Master Plan Section "Danh Mục Sách Giáo Khoa".
3. **Fragmented UI & Missing Filters**:
   - Observations 3.1 - 3.3 demonstrate that Admin, Teacher, and Student views are currently disconnected:
     * Admin cannot filter or search, cannot edit existing books, cannot toggle hide, and cannot calibrate offsets.
     * Teacher and Student catalogs lack grade, subject, and docType filters and search bars.
   - Creating a shared `TextbookCatalog` for Teacher and Student eliminates duplicated logic, applies consistent Design System tokens (`globals.css`), and fulfills R2.
4. **PDF Reader & Offset Navigation**:
   - Observation 4 shows `pdfCore.ts` is robust and memory-efficient, but neither `PdfViewer.tsx` nor `TextbookManagement.tsx`'s internal reader maps physical printed book pages to PDF pages.
   - The backend formula `pdfPage = bookPage + (base_page_offset - 1)` confirmed in Observation 4.2 must be embedded into a unified `TextbookReader` component.
   - The reader must provide dual-page indicators (`Trang sách: [bookPage]` and `(PDF trang: [pdfPage])`), jump-to-book-page input, and an Admin Calibration Bar ("Đặt trang PDF này làm Trang 1", offset stepper, live preview, save button).
5. **API Client Alignment**:
   - Observation 5 shows existing endpoints use `/documents/textbooks` and `/admin/documents/textbooks`, while R1/R2 Acceptance Criteria explicitly specify `/api/textbooks` and `/api/admin/textbooks`.
   - The frontend API client should support both routes cleanly (or call the alias), and backend should ensure both paths are valid.

---

## 3. Caveats

- **Backend Route Mapping**: Backend currently maps `/api/documents/textbooks` and `/api/admin/documents/textbooks`. Acceptance criteria specifies `/api/textbooks` and `/api/admin/textbooks`. The backend agent should expose `/api/textbooks` and `/api/admin/textbooks` (or route aliases). The frontend API client will be structured to call the exact endpoints expected.
- **Scope Limit**: As an Explorer agent operating in read-only mode, no application source files have been modified. All findings and technical plans are detailed in `frontend_report.md` for the implementing agent.

---

## 4. Conclusion

The frontend codebase is structurally sound, clean, and ready for implementing the complete Textbook system. The technical plan detailed in `frontend_report.md` establishes:
1. An upgraded **Admin Textbook Management** page (`src/admin/TextbookManagement.tsx`) with search, filters (grade, subject, status, type), comprehensive upload & edit modals, publish/hide toggle, and soft delete.
2. A shared **Textbook Catalog** (`src/textbooks/TextbookCatalog.tsx`) for Teacher and Student roles with responsive card layout, live search, multi-faceted filtering, and quick jump.
3. A dedicated **Textbook Reader** (`src/textbooks/TextbookReader.tsx`) with dual-page navigation (`bookPage` $\leftrightarrow$ `pdfPage`), instant book page jumping, and an interactive **Admin Offset Calibration Bar**.
4. Full role-based navigation integration across Admin, Teacher, and Student sidebars.
5. Standardized API client functions in `src/api.ts`.

---

## 5. Verification Method

1. **TypeScript Build Verification**:
   ```powershell
   npm run build
   ```
   *Expected*: Exit code 0, 0 TypeScript errors, bundle completes in under 25s.
2. **ESLint Verification**:
   ```powershell
   npm run lint
   ```
   *Expected*: Exit code 0, 0 errors/warnings.
3. **Artifact Review**:
   - Detailed Technical Plan: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_frontend_survey_1/frontend_report.md`
   - Progress Log: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_frontend_survey_1/progress.md`
   - Dispatch Log: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/explorer_frontend_survey_1/DISPATCH.md`
