# ERD chương trình chung và không gian giáo viên

## 1. Quyết định kiến trúc

`Program` là dữ liệu hệ thống. Admin là vai trò duy nhất được tạo, sửa, sắp xếp và
xuất bản cây `Program → Chapter → Lesson → ExerciseType` cùng tài nguyên chuẩn.
Giáo viên chỉ đọc cây này, tạo tài nguyên/phiếu bài tập do mình sở hữu, rồi phân
phối chúng cho lớp. Học sinh cùng nhìn một chương trình theo lịch hệ thống; tiến độ
cá nhân chỉ ghi nhận việc học và không quyết định chương nào đang hiện hành.

Các bất biến phải được kiểm tra ở cả API và CSDL:

- Một chương trình không thuộc giáo viên hoặc lớp.
- Chương hiện hành được suy ra từ lịch của chương trình và thời điểm hiện tại.
- `TeacherResource.owner_teacher_id` luôn là một người dùng có vai trò `TEACHER`.
- Giáo viên chỉ được sửa tài nguyên và worksheet do chính mình sở hữu.
- Một `Assignment` giao đúng một `Worksheet` cho đúng một lớp; giáo viên giao bài
  phải đang phụ trách lớp đó và sở hữu worksheet.
- Một học sinh chỉ có một submission hiện hành cho mỗi assignment; lịch sử lượt
  nộp được lưu riêng.
- Tiến độ cá nhân không được dùng để đổi thứ tự chapter/lesson.
- Admin có thể kiểm duyệt trạng thái tài nguyên giáo viên nhưng không sửa nội dung.

## 2. ERD mục tiêu

```mermaid
erDiagram
    USER ||--o{ CLASS_TEACHER : teaches
    USER ||--o{ CLASS_STUDENT : enrolls
    CLASS ||--o{ CLASS_TEACHER : has
    CLASS ||--o{ CLASS_STUDENT : has

    PROGRAM ||--|{ CHAPTER : contains
    CHAPTER ||--|{ LESSON : contains
    LESSON ||--o{ EXERCISE_TYPE : classifies
    PROGRAM ||--|{ PROGRAM_SCHEDULE : schedules
    CHAPTER ||--o{ PROGRAM_SCHEDULE : active_period
    LESSON ||--o{ PROGRAM_RESOURCE : anchors
    EXERCISE_TYPE ||--o{ PROGRAM_RESOURCE : optionally_anchors

    USER ||--o{ TEACHER_RESOURCE : owns
    LESSON ||--o{ TEACHER_RESOURCE : anchors
    EXERCISE_TYPE ||--o{ TEACHER_RESOURCE : optionally_anchors
    TEACHER_RESOURCE ||--o{ RESOURCE_SHARE : shares
    CLASS ||--o{ RESOURCE_SHARE : receives

    USER ||--o{ WORKSHEET : owns
    LESSON ||--o{ WORKSHEET : anchors
    EXERCISE_TYPE ||--o{ WORKSHEET : optionally_anchors
    WORKSHEET ||--|{ WORKSHEET_QUESTION : contains
    WORKSHEET ||--o{ ASSIGNMENT : assigned_as
    CLASS ||--o{ ASSIGNMENT : receives
    USER ||--o{ ASSIGNMENT : creates
    ASSIGNMENT ||--o{ SUBMISSION : receives
    USER ||--o{ SUBMISSION : submits
    SUBMISSION ||--|{ SUBMISSION_ANSWER : contains
    SUBMISSION ||--o{ SUBMISSION_EVENT : history

    USER ||--o{ STUDENT_LESSON_PROGRESS : tracks
    LESSON ||--o{ STUDENT_LESSON_PROGRESS : tracked_for
    USER ||--o{ STUDENT_RESOURCE_PROGRESS : tracks
    PROGRAM_RESOURCE ||--o{ STUDENT_RESOURCE_PROGRESS : tracked_for

    USER {
      bigint id PK
      varchar role_code "ADMIN|TEACHER|STUDENT"
      varchar status
    }
    PROGRAM {
      bigint id PK
      varchar code UK
      varchar name
      varchar status "DRAFT|PUBLISHED|ARCHIVED"
      bigint published_by FK
      timestamp published_at
    }
    CHAPTER {
      bigint id PK
      bigint program_id FK
      varchar title
      int order_index
      varchar status
    }
    LESSON {
      bigint id PK
      bigint chapter_id FK
      varchar title
      int order_index
      varchar status
    }
    EXERCISE_TYPE {
      bigint id PK
      bigint lesson_id FK
      varchar name
      int order_index
      varchar status
    }
    PROGRAM_SCHEDULE {
      bigint id PK
      bigint program_id FK
      bigint chapter_id FK
      date starts_on
      date ends_on
    }
    PROGRAM_RESOURCE {
      bigint id PK
      bigint lesson_id FK
      bigint exercise_type_id FK
      varchar resource_type
      varchar title
      varchar storage_key
      varchar external_url
      int order_index
      varchar status
    }
    TEACHER_RESOURCE {
      bigint id PK
      bigint owner_teacher_id FK
      bigint lesson_id FK
      bigint exercise_type_id FK
      varchar resource_type
      varchar title
      varchar storage_key
      varchar external_url
      varchar moderation_status
      varchar status
    }
    RESOURCE_SHARE {
      bigint id PK
      bigint teacher_resource_id FK
      bigint class_id FK
      bigint shared_by FK
      timestamp available_from
      timestamp available_until
      varchar status
    }
    WORKSHEET {
      bigint id PK
      bigint owner_teacher_id FK
      bigint lesson_id FK
      bigint exercise_type_id FK
      varchar title
      varchar status "DRAFT|PUBLISHED|ARCHIVED"
      int version
    }
    WORKSHEET_QUESTION {
      bigint id PK
      bigint worksheet_id FK
      varchar question_type
      text prompt
      jsonb answer_key
      numeric max_score
      int order_index
    }
    ASSIGNMENT {
      bigint id PK
      bigint worksheet_id FK
      bigint class_id FK
      bigint assigned_by FK
      timestamp opens_at
      timestamp due_at
      varchar status
    }
    SUBMISSION {
      bigint id PK
      bigint assignment_id FK
      bigint student_id FK
      int attempt_no
      varchar status
      timestamp submitted_at
      numeric raw_score
      numeric final_score
    }
    SUBMISSION_ANSWER {
      bigint id PK
      bigint submission_id FK
      bigint question_id FK
      jsonb answer
      numeric score
      text teacher_feedback
    }
    SUBMISSION_EVENT {
      bigint id PK
      bigint submission_id FK
      bigint actor_id FK
      varchar action
      timestamp created_at
    }
    STUDENT_LESSON_PROGRESS {
      bigint id PK
      bigint student_id FK
      bigint lesson_id FK
      int completion_percent
      timestamp completed_at
    }
    STUDENT_RESOURCE_PROGRESS {
      bigint id PK
      bigint student_id FK
      bigint program_resource_id FK
      varchar status
      timestamp last_opened_at
    }
```

## 3. Ràng buộc CSDL bắt buộc

Ngoài khóa ngoại, migration phải tạo các ràng buộc sau:

```text
unique (program_id, order_index)                  -- chapter
unique (chapter_id, order_index)                  -- lesson
unique (lesson_id, order_index)                   -- exercise type
unique (program_id, chapter_id)                   -- một lịch/chương
check  (starts_on <= ends_on)                     -- lịch hợp lệ
exclude (program_id WITH =, daterange(...) WITH &&) -- không chồng lịch
unique (teacher_resource_id, class_id)             -- một lần chia sẻ hiện hành
unique (worksheet_id, order_index)                 -- thứ tự câu hỏi
unique (assignment_id, student_id, attempt_no)     -- lượt nộp
unique (student_id, lesson_id)                     -- tiến độ bài học
```

PostgreSQL không thể bảo đảm vai trò của một `user_id` bằng `CHECK` xuyên bảng.
Quy tắc “đúng vai trò” phải nằm trong service và, nếu cần bảo vệ trước mọi nguồn
ghi dữ liệu, một trigger dùng chung. Không dùng enum PostgreSQL để giữ khả năng
mở rộng trạng thái qua migration ít rủi ro hơn; dùng `varchar` cùng `CHECK`.

## 4. Ánh xạ schema hiện tại

| Khái niệm mục tiêu | Schema hiện tại | Quyết định chuyển đổi |
|---|---|---|
| `Program` | `courses` | Giữ bảng và đổi tên ở tầng domain trước; bổ sung thông tin xuất bản. |
| Cây chung | `chapters`, `lessons`, `taxonomy_node` | Giữ `chapters/lessons`; chọn một nguồn duy nhất cho `ExerciseType`, không duy trì song song `problem_types` và `taxonomy_node` lâu dài. |
| `ProgramResource` | `lesson_resources`, `documents` có `owner_id is null`, `lesson_documents` | Hợp nhất về một mô hình tài nguyên chuẩn; giai đoạn chuyển tiếp có thể dùng view. |
| `TeacherResource` | `documents` có `owner_id is not null` | Tách bảng vật lý sau khi backfill; không suy luận ownership bằng `NULL` ở trạng thái đích. |
| `ResourceShare` | `class_documents` | Giữ và đổi FK sang `teacher_resources`; bỏ khả năng biến tài liệu cá nhân thành tài liệu chuẩn. |
| `Worksheet` | `worksheets`, `worksheet_items` | Giữ; chuẩn hóa `created_by` thành `owner_teacher_id`, thêm vòng đời/version. |
| `Assignment` | `assignments` | Giữ; ở trạng thái đích `worksheet_id` bắt buộc và `created_by` thành `assigned_by`. Tài liệu chỉ đọc dùng `resource_shares`, không dùng assignment. |
| `Submission` | `assignment_progress` | Tách trạng thái bài làm khỏi khái niệm progress; giữ từng attempt thay vì một dòng bị ghi đè. |
| Lịch sử submission | `assignment_submission_log` | Giữ ý nghĩa audit nhưng FK trực tiếp đến submission. |
| Tiến độ cá nhân | `learning_progress`, `problem_progress`, `lesson_document_progress` | Tách theo loại đối tượng; tuyệt đối không tham gia truy vấn xác định chương hiện hành. |

## 5. Những điểm đang xung đột với mô hình đã chốt

1. `course_teachers` và `SecurityService.checkCourseOwnership(...)` đang trao cho
   giáo viên ownership trên `courses`; điều này cho phép giáo viên sửa cây chung.
2. `class_curriculum` tạo chương trình theo lớp. Nếu chương trình là toàn hệ thống,
   bảng này chỉ nên trở thành cấu hình hiển thị/ghi chú lớp hoặc được loại khỏi luồng
   chương trình; không được quyết định cây/chương hiện hành.
3. `documents.owner_id is null/not null` đang gộp tài nguyên chuẩn và tài nguyên
   giáo viên trong một bảng. Cách này khó đặt FK và chính sách quyền rõ ràng.
4. `assignments` cho phép giao `worksheet_id`, `document_id`, hoặc cả hai. Điều này
   làm mờ ranh giới “tài nguyên để đọc” và “phiếu tương tác”.
5. `assignment_progress` vừa là tiến độ, submission, điểm và lượt nộp; cập nhật một
   dòng sẽ làm mất lịch sử các attempt.
6. Cây hiện tại chưa có lịch chương trình độc lập, nên không thể xác định chương
   hiện hành giống nhau cho mọi học sinh chỉ từ ngày hiện tại.

## 6. Kế hoạch migration không làm mất dữ liệu

Không sửa migration Flyway cũ. Thực hiện theo các đợt tương thích ngược:

1. **Khóa quyền cây chung:** đổi endpoint ghi `courses/chapters/lessons/resources`
   sang `hasRole('ADMIN')`; giáo viên chỉ còn endpoint đọc. Thêm test ma trận quyền.
2. **Thêm lịch hệ thống:** tạo `program_schedules`, backfill lịch, rồi cung cấp API
   `GET /api/programs/{id}/current-chapter?at=...`. API không nhận `student_id`.
3. **Tách tài nguyên:** tạo `program_resources`, `teacher_resources`,
   `resource_shares`; backfill từ `documents`, `lesson_documents`,
   `class_documents`; dual-read trong một phiên bản rồi chuyển FK.
4. **Chuẩn hóa worksheet:** thêm ownership, version và trạng thái khóa sau phát
   hành. Worksheet đã phát hành chỉ được nhân bản, không sửa câu hỏi tại chỗ.
5. **Tách submission:** tạo `submissions`, `submission_answers`,
   `submission_events`; backfill `assignment_progress` và log; chuyển service ghi
   mới, sau đó giữ bảng cũ ở chế độ chỉ đọc cho đến khi đối soát xong.
6. **Tách progress:** tạo bảng tiến độ theo loại đối tượng và chuyển các truy vấn
   dashboard. Xóa mọi điều kiện progress khỏi truy vấn chương hiện hành.
7. **Dọn tương thích:** chỉ sau ít nhất một bản phát hành ổn định mới bỏ cột/bảng
   cũ. Mỗi bước cần migration mới và kiểm tra Flyway checksum.

## 7. Ma trận quyền API tối thiểu

| Năng lực | Admin | Teacher | Student |
|---|---:|---:|---:|
| Ghi chương trình/chương/bài/dạng/tài nguyên chuẩn/lịch | Có | Không | Không |
| Đọc chương trình đã xuất bản | Có | Có | Có |
| Tạo/sửa tài nguyên giáo viên | Kiểm duyệt trạng thái | Chỉ của mình | Không |
| Chia sẻ tài nguyên cho lớp | Không | Lớp mình phụ trách | Không |
| Tạo/sửa worksheet | Không | Chỉ của mình, khi chưa phát hành | Không |
| Giao worksheet | Không | Lớp mình phụ trách | Không |
| Xem bài làm/nhận xét chi tiết | Không | Học sinh được giao | Chỉ của mình |
| Làm/nộp bài | Không | Không | Chỉ assignment được giao và đang mở |

Quyền “Admin kiểm duyệt” chỉ cho phép ẩn, vô hiệu hóa hoặc xử lý vi phạm; không
cho phép sửa nội dung riêng của giáo viên và không mở quyền xem nhận xét/bài làm
cụ thể của học sinh.
