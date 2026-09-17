# Kế hoạch Tài chính — học phí minh bạch, QR, thanh toán có xác nhận

Soạn 17/09/2026 trên nhánh `feat/vong-doi-bai-giao`. Đối chiếu với mockup
"Math10 Học phí & Thanh toán" và code đang có trong cây làm việc.

Ba đề xuất đã chốt giữ lại:

1. **Mã thanh toán theo từng kỳ**, không theo cả khoản học phí.
2. **Giao dịch có trạng thái `NEEDS_REVIEW`**: chuyển thiếu, sai nội dung, hoặc học sinh báo đã chuyển mà sao kê chưa có.
3. **Chính sách hoàn/hủy hiện cho học sinh**, và **thông báo 30 ngày khi đổi tài khoản nhận tiền**.

---

## 0. Hiện trạng: module đã có khung, nhưng chưa commit

| | |
|---|---|
| Migration | `V202609131400__hoc_phi_va_thanh_toan.sql` — **chưa commit** (`??`) |
| Code | `finance/FinanceController.java` (217 dòng, 15 endpoint), `finance/FeeDraftService.java` — **chưa commit** |
| Test | `FinanceFlowTest` — 6 ca, chạy Zonky |
| Log dev gần nhất (04/09) | Schema dừng ở `202609075000`, tức lúc đó DB dev **chưa chạy** migration tài chính |

**Việc đầu tiên:** kiểm `flyway_schema_history` trên Neon (dev và staging) xem có `202609131400` chưa.

- **Đã chạy ở bất kỳ đâu dùng chung:** giữ nguyên file, mọi thay đổi dưới đây là migration vá. Đây là giả định của kế hoạch này.
- **Chưa chạy ở đâu:** vẫn nên làm theo migration vá. Chi phí gần như bằng nhau, và làm vậy không phải đoán sai về trạng thái DB.

Trong mọi trường hợp: **commit migration và module `finance/` hiện có thành một bản ghi riêng trước khi sửa**, để phần vá có gốc để so.

### Cái đã đúng, giữ nguyên

- `student_fees` là **một dòng cho một kỳ**, và mỗi dòng có `payment_reference` unique. Đề xuất 1 đã có về mặt dữ liệu, chỉ còn đổi định dạng mã.
- Học sinh báo đã chuyển thì giao dịch chỉ ở `PROCESSING`. Chỉ `SUCCESS` mới cộng vào "đã đóng" (test `hocSinhBaoChuyenTienChuaDuocTinhLaDaDong`).
- `SUCCESS` bắt buộc có `confirmed_by`, `confirmed_at` và `provider_transaction_id` (ràng buộc CHECK). Mã giao dịch ngân hàng là unique theo tài khoản.
- `my-fees` không trả dòng `DRAFT`. `OVERDUE` được suy ra lúc đọc, không lưu.
- Số buổi tính từ `course_delivery_sessions`, là buổi của Khóa và không mang ngày. Đúng quy tắc "Buổi KHÔNG gắn ngày".
- Đổi chính sách không sửa khoản đã lập (test `doiChinhSachKhongSuaKhoanDaPhatHanh`).

### Lỗ hổng so với thiết kế đã chốt

| # | Vấn đề | Hậu quả |
|---|---|---|
| L1 | Không có dòng chi tiết phép tính: `student_fees` chỉ lưu `amount` | Không trả lời được "vì sao 5.000.000 ₫" |
| L2 | Không snapshot số buổi, đơn giá, phiên bản chính sách | Sau khi đổi khóa từ 36 lên 40 buổi thì không còn biết khoản cũ tính từ đâu |
| L3 | Giảm giá chỉ có một số `discount_amount` cấp khóa | Không có học bổng hay ưu đãi riêng từng học sinh, mỗi khoản một dòng |
| L4 | **Tài khoản nhận tiền sửa được tại chỗ.** Khoản đã xác nhận chỉ trỏ `payment_account_id` | Đổi số tài khoản thì khoản cũ lặng lẽ hiện số mới. Đây là lỗi minh bạch nặng nhất |
| L5 | Xác nhận theo từng dòng kỳ (`/fees/{id}/publish`) | Admin có thể xác nhận kỳ 1 mà quên kỳ 2; học sinh thấy tổng sai |
| L6 | `forClass()` **không được gọi ở đâu** | Ghi danh vào lớp không sinh DRAFT, Admin phải bấm tay theo khóa |
| L7 | Chưa có `NEEDS_REVIEW`, chưa có dòng sao kê để đối soát | Màn Đối soát không có cột "Giao dịch ghi nhận" |
| L8 | `ONLINE` có trong CHECK nhưng không có cổng, không có webhook. `confirmed_by NOT NULL` chặn xác nhận tự động | Không làm được "cổng thanh toán báo về" |
| L9 | Chưa có chính sách hoàn/hủy | Đề xuất 3 |
| L10 | Đọc học phí của học sinh viết rải rác: `where f.student_id=?` trong `myFees`, còn kiểm chủ sở hữu bằng Java trong `report()` | Trái quy tắc "Quyền đọc nằm trong MỘT hàm duy nhất, trong câu query" |
| L11 | `my-fees` dùng `FEE_SELECT` với `f.*` | Học sinh nhận cả `confirmed_by`, `account_status` và các cột nội bộ |
| L12 | Chuỗi hỏng mã hóa `"?? l?p kho?n thu nh?p"` ở `generate()` | Thông báo vỡ trên giao diện |

---

## 1. Migration — ba file vá, chỉ thêm, không xóa cột

Đổi CHECK được làm bằng cách `drop constraint` rồi `add constraint`, không đụng cột. PG đặt tên CHECK tự động là `<bảng>_<cột>_check`, riêng CHECK nhiều cột là `<bảng>_check`. Phải xác nhận tên thật bằng `\d` trước khi viết.

### M1 `V202609171000__ke_hoach_hoc_phi_va_snapshot.sql` — lát F1, F2

```sql
-- Chính sách có phiên bản + chính sách hoàn/hủy + bật thanh toán trực tuyến
alter table course_fee_policies add column version integer not null default 1;
alter table course_fee_policies add column refund_policy text;
alter table course_fee_policies add column online boolean not null default false;

create table course_fee_policy_versions (
  course_instance_id bigint not null references course_instances(id),
  version            integer not null,
  snapshot           jsonb not null,          -- toàn bộ dòng policy lúc lưu
  updated_by         bigint not null references users(id),
  updated_at         timestamp not null default now(),
  primary key (course_instance_id, version)
);

-- Một kế hoạch học phí cho một học sinh trong một khóa (qua một lớp)
create table student_fee_plans (
  id                  bigserial primary key,
  course_instance_id  bigint not null references course_instances(id),
  student_id          bigint not null references users(id),
  class_id            bigint references classes(id),
  class_student_id    bigint references class_students(id),
  status              varchar(20) not null default 'DRAFT'
                      check (status in ('DRAFT','CONFIRMED','CANCELLED')),
  -- snapshot, chỉ ghi lúc tính; bị khóa sau khi CONFIRMED
  policy_version      integer,
  calculation         varchar(20),
  session_count       integer,
  unit_price          numeric(15,0),
  refund_policy       text,
  payment_account_id  bigint not null references payment_accounts(id),
  base_amount         numeric(15,0) not null,
  discount_total      numeric(15,0) not null default 0,
  additional_total    numeric(15,0) not null default 0,
  final_amount        numeric(15,0) not null check (final_amount > 0),
  needs_attention     varchar(40),            -- vd 'STUDENT_LEFT_CLASS'
  confirmed_by        bigint references users(id),
  confirmed_at        timestamp,
  created_at          timestamp not null default now(),
  updated_at          timestamp not null default now(),
  check (final_amount = base_amount - discount_total + additional_total),
  check (status <> 'CONFIRMED' or (confirmed_by is not null and confirmed_at is not null))
);
create unique index student_fee_plans_one_live
  on student_fee_plans(course_instance_id, student_id) where status <> 'CANCELLED';

create table student_fee_items (
  id           bigserial primary key,
  plan_id      bigint not null references student_fee_plans(id),
  kind         varchar(30) not null check (kind in
               ('BASE','COURSE_DISCOUNT','SCHOLARSHIP','STUDENT_DISCOUNT','PROMOTION',
                'ADDITIONAL_FEE','ADJUSTMENT')),
  description  varchar(250) not null,          -- câu học sinh đọc được
  quantity     integer,
  unit_price   numeric(15,0),
  amount       numeric(15,0) not null,         -- âm = giảm
  internal_note text,                          -- không bao giờ trả cho học sinh
  created_by   bigint not null references users(id),
  created_at   timestamp not null default now()
);
create index student_fee_items_plan on student_fee_items(plan_id);

-- Nối kỳ vào kế hoạch; dòng cũ được backfill bên dưới
alter table student_fees add column plan_id bigint references student_fee_plans(id);
alter table student_fees add column class_id bigint references classes(id);

-- Đề xuất 1: mã so khớp bỏ dấu, không phân biệt hoa thường
alter table student_fees add column reference_key varchar(30)
  generated always as (upper(regexp_replace(payment_reference,'[^A-Za-z0-9]','','g'))) stored;
create unique index student_fees_reference_key on student_fees(reference_key);

-- Điều chỉnh sau xác nhận: không sửa âm thầm, mỗi lần một dòng
create table student_fee_adjustments (
  id              bigserial primary key,
  plan_id         bigint not null references student_fee_plans(id),
  item_id         bigint not null references student_fee_items(id),
  student_fee_id  bigint references student_fees(id),   -- kỳ bị đổi hoặc được tạo
  amount_before   numeric(15,0),
  amount_after    numeric(15,0),
  reason          text not null,
  actor_id        bigint not null references users(id),
  created_at      timestamp not null default now()
);
```

**Backfill trong cùng file:** với mỗi cặp `(course_instance_id, student_id)` đã có trong `student_fees`, tạo một `student_fee_plans`:

- `base_amount = final_amount = sum(amount)`
- `status`: `CONFIRMED` nếu có kỳ khác `DRAFT`/`CANCELLED`, ngược lại `DRAFT`
- `session_count`, `unit_price`, `policy_version` để `NULL`
- thêm một item `BASE` với mô tả "Học phí (lập trước khi có bảng chi tiết)"

Sau đó gán `plan_id`. `confirmed_by`/`confirmed_at` lấy từ kỳ được xác nhận sớm nhất. `plan_id` để nullable để migration không phụ thuộc thứ tự; tầng service luôn ghi `plan_id`.

### M2 `V202609171100__tai_khoan_nhan_tien_bat_bien.sql` — lát F3

```sql
alter table payment_accounts add column verified_by bigint references users(id);
alter table payment_accounts add column verified_at timestamp;
alter table payment_accounts add column replaced_by_id bigint references payment_accounts(id);

-- Trường định danh người nhận không sửa được: đổi = tạo tài khoản mới
create function payment_accounts_identity_frozen() returns trigger language plpgsql as $$
begin
  if (new.bank_code, new.account_number, new.account_holder, new.beneficiary_name)
     is distinct from (old.bank_code, old.account_number, old.account_holder, old.beneficiary_name) then
    raise exception 'Không sửa thông tin người nhận của tài khoản đã tạo; hãy tạo tài khoản mới';
  end if;
  return new;
end $$;
create trigger payment_accounts_identity_frozen before update on payment_accounts
  for each row execute function payment_accounts_identity_frozen();

-- Snapshot người nhận trên kế hoạch lúc xác nhận
alter table student_fee_plans add column payee_snapshot jsonb;

-- Đề xuất 3: lịch sử đổi tài khoản, dùng cho thông báo 30 ngày
create table payment_account_changes (
  id               bigserial primary key,
  from_account_id  bigint not null references payment_accounts(id),
  to_account_id    bigint not null references payment_accounts(id),
  reason           text not null,
  fees_moved       integer not null default 0,
  changed_by       bigint not null references users(id),
  second_confirmed_by bigint references users(id),
  changed_at       timestamp not null default now(),
  check (from_account_id <> to_account_id)
);
create index payment_account_changes_to on payment_account_changes(to_account_id, changed_at);
```

Trigger là tầng chặn thứ hai. Tầng thứ nhất là không có endpoint sửa các trường đó.

### M3 `V202609171200__doi_soat_va_cong_thanh_toan.sql` — lát F5, F6

```sql
-- Đề xuất 2
alter table payment_transactions drop constraint payment_transactions_status_check;
alter table payment_transactions add constraint payment_transactions_status_check
  check (status in ('PENDING','PROCESSING','NEEDS_REVIEW','SUCCESS','FAILED','CANCELLED','REFUNDED'));
alter table payment_transactions add column review_reason varchar(40);   -- AMOUNT_SHORT, AMOUNT_OVER, REFERENCE_MISMATCH, NOT_ON_STATEMENT
alter table payment_transactions add column observed_amount numeric(15,0);

-- Mỗi kỳ chỉ một giao dịch đang mở, tính cả NEEDS_REVIEW
drop index payment_transactions_one_pending;
create unique index payment_transactions_one_open on payment_transactions(student_fee_id)
  where status in ('PENDING','PROCESSING','NEEDS_REVIEW');

-- Xác nhận tự động từ cổng: không có người bấm
alter table payment_transactions drop constraint payment_transactions_check;
alter table payment_transactions add constraint payment_transactions_success_evidence
  check (status <> 'SUCCESS' or (confirmed_at is not null and provider_transaction_id is not null
         and (confirmed_by is not null or provider <> 'MANUAL')));
alter table payment_confirmation_events alter column actor_id drop not null;
alter table payment_confirmation_events add column actor_kind varchar(20) not null default 'USER'
  check (actor_kind in ('USER','GATEWAY','SYSTEM'));

-- Dòng sao kê: nhập file hoặc nhận từ webhook ngân hàng
create table bank_statement_lines (
  id                       bigserial primary key,
  payment_account_id       bigint not null references payment_accounts(id),
  source                   varchar(30) not null,          -- CSV_IMPORT, BANK_WEBHOOK
  provider_transaction_id  varchar(160) not null,
  amount                   numeric(15,0) not null,
  description              text not null,
  booked_at                timestamp not null,
  extracted_reference_key  varchar(30),
  matched_transaction_id   bigint references payment_transactions(id),
  match_status             varchar(20) not null default 'UNMATCHED'
                           check (match_status in ('UNMATCHED','MATCHED','NEEDS_REVIEW','IGNORED')),
  imported_by              bigint references users(id),
  created_at               timestamp not null default now(),
  unique (payment_account_id, provider_transaction_id)
);

-- Sự kiện thô từ cổng: idempotent theo event_id
create table payment_gateway_events (
  id              bigserial primary key,
  provider        varchar(50) not null,
  event_id        varchar(160) not null,
  signature_valid boolean not null,
  payload         jsonb not null,
  transaction_id  bigint references payment_transactions(id),
  received_at     timestamp not null default now(),
  processed_at    timestamp,
  error           text,
  unique (provider, event_id)
);
```

Tên `payment_transactions_status_check` và `payment_transactions_check` phải được xác nhận bằng `\d payment_transactions` trước khi viết file.

---

## 2. Backend — tách `FinanceController` theo trách nhiệm

Giữ JdbcTemplate như code hiện có, không thêm entity JPA cho các bảng tài chính. Trả **record DTO**, không trả `Map` nữa: DTO cho học sinh và DTO cho admin là hai kiểu khác nhau (L11).

```
finance/
  read/FinanceReadQuery.java        ← hàm đọc duy nhất (L10)
  policy/FeePolicyController, FeePolicyService
  plan/FeeCalculator.java           ← hàm thuần, không DB
  plan/FeePlanService.java          ← draft, sửa item, confirm, adjust, cancel
  plan/EnrollmentFeeListener.java   ← nối ghi danh (L6)
  account/PaymentAccountController, PaymentAccountService
  payment/StudentPaymentController  ← /api/finance/me/...
  payment/PaymentService            ← report, startOnline
  recon/ReconciliationController, ReconciliationService, StatementImporter
  gateway/PaymentGateway (interface), GatewayWebhookController, GatewaySignatureVerifier
  dto/…                              ← StudentFeeView, AdminFeeRow, PlanDetail, …
```

`FinanceController` cũ giữ đường dẫn trong một lát để giao diện không gãy, chỉ gọi sang service mới, rồi xóa ở F7.

### FinanceReadQuery — quyền đọc ở một chỗ

```java
// Mọi đường đọc student_fees / plans / transactions đi qua đây.
// Điều kiện quyền nằm trong WHERE, không kiểm lại bằng Java.
static final String VISIBLE = """
  (:role = 'ADMIN'
   or (:role = 'STUDENT' and p.student_id = :viewer and p.status = 'CONFIRMED'))
  """;
List<StudentFeeView> studentFees(Viewer v);
Optional<FeeForPayment> feeForPayment(Viewer v, long feeId);   // report() dùng hàm này, rỗng → 404
List<AdminFeeRow> adminFees(Viewer v, FeeFilter f);
```

- Học sinh **không bao giờ** thấy plan `DRAFT` (thiết kế mục 10). Thay vào đó, `studentFees` trả thêm `pendingCourses` với các khóa có plan `DRAFT`. Giao diện hiện "Học phí đang được xác nhận", không có số tiền, không có QR.
- `StudentFeeView` chỉ gồm:
  - tiêu đề, kỳ, số tiền, hạn, đã đóng, còn lại, trạng thái hiển thị
  - `items[]`: chỉ `description` và `amount`, không `kind`, không `internal_note`
  - payee lấy từ `payee_snapshot`, `referenceDisplay`, `qrPayload`, `refundPolicy`
  - `accountChangedAt`, chỉ có giá trị khi có đổi tài khoản trong 30 ngày

### FeeCalculator — hàm thuần

```java
record PolicySnapshot(int version, String calculation, BigDecimal unitPrice,
                      BigDecimal courseDiscount, int installments,
                      LocalDate firstDue, int periodMonths, String refundPolicy) {}
record Line(String kind, String description, Integer qty, BigDecimal unitPrice, BigDecimal amount) {}
record Result(List<Line> lines, BigDecimal base, BigDecimal discounts,
              BigDecimal additional, BigDecimal total, List<Installment> installments) {}

Result calculate(PolicySnapshot p, int sessionCount, List<Line> studentLines);
```

- `PER_SESSION`: base = `unitPrice × sessionCount`, với `sessionCount` đếm từ `course_delivery_sessions` và không bao giờ nhập tay. `FIXED`: base = `unitPrice`.
- Chia kỳ giữ nguyên thuật toán hiện có: làm tròn xuống, kỳ cuối nhận phần dư.
- Tổng âm hoặc bằng 0 → `BusinessException`. Chưa có đường miễn phí; khi cần sẽ là một lát riêng.
- Không có `eval`, không có công thức tự do. `PER_PERIOD` và `CUSTOM_RULE` **chưa làm**, vì CHECK hiện chỉ có `PER_SESSION` và `FIXED`. Thêm sau, mỗi kiểu một lát.

### FeePlanService — vòng đời

| Hành động | Điều kiện | Tác dụng |
|---|---|---|
| `draftFor(classStudentId, courseId)` | Có policy, tài khoản `ACTIVE`, chưa có plan sống | Tạo plan `DRAFT`, các item, và N dòng `student_fees` `DRAFT`. Idempotent |
| `recalculate(planId)` | `DRAFT` | Đọc lại policy và số buổi, ghi lại item `BASE`/`COURSE_DISCOUNT`, cập nhật **tại chỗ** số tiền các kỳ `DRAFT` |
| `addItem / removeItem(planId, …)` | `DRAFT`, `kind` ≠ `BASE` | Thêm học bổng hoặc ưu đãi riêng (bắt buộc có mô tả), rồi `recalculate` |
| `confirm(planId)` | `DRAFT`, tài khoản `ACTIVE` | Ghi `payee_snapshot`, chuyển plan và **mọi** kỳ sang `CONFIRMED` trong một giao dịch (L5), ghi audit |
| `adjust(planId, amount, description, reason)` | `CONFIRMED` | Thêm item `ADJUSTMENT` và một dòng `student_fee_adjustments`. Dương: tạo kỳ mới. Âm: giảm các kỳ **chưa có giao dịch `SUCCESS`**, bắt đầu từ kỳ cuối. Không đủ để giảm → lỗi, cần hoàn tiền (ngoài phạm vi) |
| `cancel(planId)` | Không có giao dịch mở hoặc `SUCCESS` | Plan và các kỳ chuyển `CANCELLED` |

`/fees/{id}/publish` cũ được chuyển sang `confirm(plan của kỳ đó)`.

Mã thanh toán cho kỳ mới có dạng `HP{yy}{planId 6 số}K{n}`, ví dụ `HP26001245K2`. Không có khoảng trắng hay gạch vì nhiều ngân hàng tự bỏ ký tự đặc biệt. Giao diện hiển thị có khoảng cách (`HP26 001245 K2`) và nút sao chép bản không khoảng cách. Mã cũ `HP-2026-000123` vẫn khớp được nhờ cột `reference_key`.

### EnrollmentFeeListener — nối ghi danh (L6)

- `EnrollmentServiceImpl.addStudentToClass` phát `StudentEnrolledEvent(classStudentId)`. `assignCourseToClass` phát `CourseAssignedToClassEvent(classId, courseId)`.
- Listener dùng `@TransactionalEventListener(phase = AFTER_COMMIT)` rồi gọi `draftFor` trong giao dịch mới. Lỗi chính sách (chưa có policy, chưa có buổi) **không** được làm hỏng việc ghi danh: ghi log và audit `FEE_DRAFT_SKIPPED`.
- `removeStudent` phát `StudentLeftClassEvent`:
  - plan `DRAFT` → tự `cancel`
  - plan `CONFIRMED` → **không tự hủy**, chỉ đặt `needs_attention = 'STUDENT_LEFT_CLASS'` để Admin xử lý theo chính sách hoàn/hủy
- `FeeDraftService.generate(courseId)` giữ làm nút "Lập lại cho cả khóa". Nó gọi `draftFor` cho từng ghi danh.

### PaymentAccountService (đề xuất 3, L4)

- `create`: tạo tài khoản ở trạng thái `ACTIVE` nhưng chưa xác minh. Chính sách **không chọn được** tài khoản chưa có `verified_at`.
- `verify(id)`: người xác minh phải khác người tạo.
- `replace(fromId, input, reason)`: tạo tài khoản mới, đặt `replaced_by_id`, chuyển tài khoản cũ sang `INACTIVE`. Repoint các `course_fee_policies`. Với các kỳ `CONFIRMED`/`PARTIALLY_PAID` chưa có giao dịch mở: đổi `payment_account_id`, cập nhật `payee_snapshot` của plan, ghi `payment_account_changes` kèm `fees_moved`. Cần `second_confirmed_by` (người thứ hai) mới có hiệu lực.
- **Không có endpoint `PUT` sửa số tài khoản.** Chỉ `name` và `status` sửa được.
- Học sinh thấy "Thông tin nhận tiền đã thay đổi ngày dd/MM" khi `payment_account_changes.to_account_id = fee.payment_account_id` và `changed_at > now() - 30 days`.

### PaymentService

- `report(feeId, amount, method = BANK_QR)` đi qua `FinanceReadQuery.feeForPayment`, tạo giao dịch `PROCESSING` như hiện nay. Nếu có dòng sao kê `UNMATCHED` cùng `reference_key` thì so khớp ngay (xem dưới).
- `startOnline(feeId)`: kỳ phải bật `online` (lấy từ policy lúc confirm). Tạo giao dịch `PENDING` với `method = ONLINE` và `provider = <cổng>`, gọi `PaymentGateway.createCheckout`, trả URL chuyển hướng. Số tiền luôn là phần còn lại của kỳ; học sinh không được nhập.

### ReconciliationService (đề xuất 2)

So khớp một dòng sao kê với giao dịch đang mở của kỳ có cùng `reference_key`:

| Tình huống | Kết quả |
|---|---|
| Khớp mã và `amount == còn lại của kỳ` | Admin bấm "Xác nhận đã nhận": `SUCCESS`, `provider_transaction_id` lấy từ dòng sao kê |
| Khớp mã nhưng thiếu hoặc thừa tiền | Giao dịch `NEEDS_REVIEW`, `review_reason = AMOUNT_SHORT` hoặc `AMOUNT_OVER`, `observed_amount` = số trên sao kê |
| Học sinh báo đã chuyển, 2 ngày làm việc chưa có dòng sao kê | Job hằng ngày chuyển giao dịch sang `NEEDS_REVIEW` với `NOT_ON_STATEMENT` |
| Có dòng sao kê nhưng không có mã hợp lệ | `bank_statement_lines.match_status = NEEDS_REVIEW`; Admin gán tay vào một kỳ |

Hành động của Admin trên một giao dịch `NEEDS_REVIEW`:

- **Ghi nhận một phần:** `SUCCESS` với `amount = observed_amount`. Kỳ chuyển `PARTIALLY_PAID`. Mọi thay đổi số tiền được ghi vào `payment_confirmation_events`.
- **Từ chối:** `FAILED`, bắt buộc có lý do, học sinh được báo lại.
- **Thừa tiền:** chỉ ghi nhận đến mức còn lại. Phần thừa để ở dòng sao kê (`IGNORED` kèm ghi chú). Hoàn tiền là việc ngoài hệ thống ở lát này.

Mọi xác nhận thủ công bắt buộc có: người xác nhận, thời điểm, phương thức, mã giao dịch ngân hàng hoặc số phiếu thu, ghi chú. Phần kiểm tra hiện có được giữ nguyên.

`StatementImporter`: nhập CSV sao kê theo cấu hình cột của từng ngân hàng. Dòng trùng `provider_transaction_id` được bỏ qua.

### Cổng thanh toán (L8)

- `PaymentGateway` gồm `createCheckout(tx)`, `verify(headers, body)`, `parse(body) → GatewayEvent`.
- Đường webhook: `POST /api/public/payments/{provider}/webhook`, nằm dưới `/api/public/**` nên đã `permitAll`. Trình tự xử lý:
  1. Kiểm chữ ký. Sai chữ ký vẫn ghi `payment_gateway_events` với `signature_valid = false`, trả 401, không xử lý tiếp.
  2. `insert … on conflict (provider, event_id) do nothing`. Sự kiện trùng thì trả 200 và dừng.
  3. Khóa kỳ, kiểm số tiền và mã. Khớp → `SUCCESS` với `confirmed_by = null`, `provider = <cổng>`, sự kiện `actor_kind = GATEWAY`. Lệch → `NEEDS_REVIEW`.
- Trang "quay về" sau khi thanh toán **không** đổi trạng thái; chỉ webhook mới đổi.
- Chưa chọn nhà cung cấp (xem mục 4). Lát F6 làm interface, một `FakeGateway` cho test, và webhook sao kê ngân hàng nếu chọn hướng đó.

---

## 3. Thứ tự lát và tiêu chí xong

| Lát | Nội dung | Xong khi |
|---|---|---|
| **F0** | Kiểm `flyway_schema_history`. Commit riêng migration + `finance/` hiện có. Sửa chuỗi hỏng (L12) | `FinanceFlowTest` xanh trên commit đó |
| **F1** | M1, `FeeCalculator`, `FeePlanService` (draft/recalculate/items/confirm), backfill | Test thuần `FeeCalculator`: 36 × 150.000 − 100.000 và chia 3 kỳ không mất đồng nào. Test: đổi số buổi 36→40 sau confirm thì plan vẫn ghi 36 và số tiền không đổi. Test: confirm một plan chuyển **tất cả** kỳ. Test backfill trên dữ liệu `FinanceFlowTest` cũ |
| **F2** | `FinanceReadQuery`, DTO học sinh, `pendingCourses`, chính sách hoàn/hủy trong policy và snapshot | Test: học sinh không thấy `DRAFT`, không thấy `kind`/`internal_note`/`confirmed_by`. Test: học sinh B gọi `report` vào kỳ của A thì nhận 404 (không phải 403, để không lộ việc kỳ đó tồn tại). Thêm endpoint vào `PermissionMatrixTest` |
| **F3** | M2, `PaymentAccountService` (create/verify/replace), thông báo 30 ngày | Test: `update` số tài khoản bị trigger chặn. Test: `replace` chuyển kỳ chưa đóng, giữ nguyên kỳ đã có `SUCCESS`, `accountChangedAt` hiện trong 30 ngày rồi tắt. Test: người tạo không tự xác minh được |
| **F4** | Nối ghi danh (listener), học sinh rời lớp, `adjust` | Test: thêm học sinh vào lớp có khóa có policy thì sinh plan `DRAFT`. Test: khóa chưa có buổi thì ghi danh vẫn thành công. Test: rời lớp khi `CONFIRMED` thì plan có `needs_attention`, không bị hủy. Test: `adjust` âm không chạm kỳ đã đóng |
| **F5** | M3 (phần đối soát), `NEEDS_REVIEW`, nhập sao kê, job 2 ngày, API màn Đối soát | Test: thiếu 200.000 thì `NEEDS_REVIEW`, ghi nhận một phần thì kỳ `PARTIALLY_PAID`. Test: nhập trùng file sao kê không nhân đôi. Test: mã `hp26-001245 k2` khớp `HP26001245K2` |
| **F6** | M3 (phần cổng), `PaymentGateway`, webhook, `startOnline` | Test với `FakeGateway`: chữ ký sai → 401 và không đổi trạng thái; gửi cùng sự kiện 2 lần → chỉ 1 `SUCCESS`; lệch số tiền → `NEEDS_REVIEW` |
| **F7** | Xóa đường dẫn cũ trong `FinanceController` (sau khi giao diện đã chuyển) | Không còn `Map<String,Object>` trong response tài chính |

F1 → F2 → F3 là bắt buộc trước khi cho học sinh thấy bất kỳ số tiền nào. F5 và F6 độc lập với nhau.

---

## 4. Câu hỏi mở — cần chủ trung tâm trả lời trước F5/F6

1. **Cổng thanh toán nào?** Có hai hướng: webhook sao kê ngân hàng (chỉ QR chuyển khoản, tự khớp) hoặc cổng thẻ/ví (có trang thanh toán riêng). Lựa chọn quyết định `PaymentGateway` đầu tiên và phí giao dịch.
2. **Người xác minh thứ hai** cho tài khoản nhận tiền: trung tâm có ít nhất hai Admin không? Nếu chỉ có một người thì F3 cần một đường thay thế, ví dụ mã xác nhận gửi qua email chủ trung tâm.
3. **Thừa tiền và hoàn tiền:** tạm thời xử lý ngoài hệ thống (mục 2). Có cần ghi nhận khoản hoàn ngay không?
4. **Chính sách hoàn/hủy:** một đoạn văn cho mỗi khóa (như kế hoạch này) hay mẫu chung cho toàn trung tâm, khóa chỉ ghi đè khi cần?
