## 2026-09-12T23:59:21Z
You are the Specification & Requirements Miner agent.
Your working directory is: c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/
You must read:
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/ORIGINAL_REQUEST.md
- c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/MATH10_MASTER_PLAN.md (specifically Section 'Danh Mục Sách Giáo Khoa' and any related sections)

Your task:
1. Conduct a deep requirements mining of all textbook (SGK/SBT) requirements, metadata fields (title, subject, grade, total_pages, base_page_offset, pdf_url, cover_url, description, is_published, deleted_at, etc.).
2. Document the exact page offset calculation formula: pdfPage = bookPage + (base_page_offset - 1), boundary conditions, 1-indexed semantics, and calibration rules.
3. Document role capabilities & RBAC matrix:
   - ADMIN: CRUD, publish, hide, soft delete, offset calibration.
   - TEACHER / STUDENT: Read published textbooks only, open textbook with bookPage -> pdfPage mapping.
4. Document all API endpoints required with request/response schemas and error conditions (401, 403, 404, 400).
5. Document all acceptance criteria and edge cases.
6. Write your detailed findings to c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/spec_report.md and your completion handoff to c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/handoff.md.
7. Send a message to the caller when done with the report path and summary.
