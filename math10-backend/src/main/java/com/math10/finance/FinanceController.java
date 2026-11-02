package com.math10.finance;

import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/finance")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class FinanceController {
    private final JdbcTemplate jdbc;
    private final CurrentUserService current;
    private final AuditService audit;
    private final FeeDraftService drafts;

    public record AccountInput(@NotBlank @Size(max=120) String name,
        @NotBlank @Size(max=200) String beneficiaryName,
        @NotBlank @Pattern(regexp="[A-Za-z0-9]{3,30}") String bankCode,
        @NotBlank @Size(max=120) String bankName,
        @NotBlank @Pattern(regexp="[A-Za-z0-9]{4,40}") String accountNumber,
        @NotBlank @Size(max=150) String accountHolder,
        @NotBlank @Pattern(regexp="[A-Za-z0-9_]{1,80}") String qrTemplate) {}
    public record PolicyInput(@NotNull Long paymentAccountId,
        @NotBlank @Pattern(regexp="PER_SESSION|FIXED") String calculation,
        @NotNull @DecimalMin("1") @DecimalMax("999999999999") @Digits(integer=12,fraction=0) BigDecimal unitPrice,
        @NotNull @DecimalMin("0") @Digits(integer=12,fraction=0) BigDecimal discountAmount,
        @Min(1) @Max(36) int installments,@NotNull LocalDate firstDueDate,
        @Min(1) @Max(12) int periodMonths, boolean prorate,boolean bankQr,boolean cash) {}
    public record TransactionInput(@NotNull @DecimalMin("1") @Digits(integer=12,fraction=0) BigDecimal amount,
        @NotBlank @Pattern(regexp="BANK_QR|CASH") String method,@Size(max=1000) String note) {}
    public record ConfirmationInput(@NotBlank @Size(max=160) String transactionReference,
        @NotBlank @Pattern(regexp="BANK_RECONCILIATION|CASH_RECEIPT") String confirmationMethod,
        @NotBlank @Size(max=1000) String note) {}

    @GetMapping("/accounts")
    public ApiResponse<List<Map<String,Object>>> accounts() {
        return ApiResponse.ok("Tài khoản nhận tiền",jdbc.queryForList("select * from payment_accounts order by id desc"));
    }
    @PostMapping("/accounts") @Transactional
    public ApiResponse<Long> account(@Valid @RequestBody AccountInput x) {
        Long id=jdbc.queryForObject("""
          insert into payment_accounts(name,beneficiary_name,bank_code,bank_name,account_number,account_holder,qr_template)
          values(?,?,?,?,?,?,?) returning id
          """,Long.class,x.name().trim(),x.beneficiaryName().trim(),x.bankCode().trim(),x.bankName().trim(),x.accountNumber().trim(),x.accountHolder().trim(),x.qrTemplate());
        audit.record("CREATE_PAYMENT_ACCOUNT","PAYMENT_ACCOUNT",id,null,"{\"name\":\"created\"}");
        return ApiResponse.created("Đã tạo tài khoản nhận tiền",id);
    }

    @GetMapping("/courses/{courseId}/policy")
    public ApiResponse<Map<String,Object>> policy(@PathVariable long courseId) {
        var rows=jdbc.queryForList("""
          select p.*,a.name account_name,a.bank_name,a.account_number,a.account_holder,a.beneficiary_name,
          (select count(*) from course_delivery_sessions s where s.course_instance_id=p.course_instance_id and s.deleted_at is null) session_count
          from course_fee_policies p join payment_accounts a on a.id=p.payment_account_id where p.course_instance_id=?
          """,courseId);
        return ApiResponse.ok("Chính sách học phí",rows.isEmpty()?null:rows.get(0));
    }
    @PutMapping("/courses/{courseId}/policy") @Transactional
    public ApiResponse<Void> policy(@PathVariable long courseId,@Valid @RequestBody PolicyInput x) {
        if(!x.bankQr()&&!x.cash())throw new BusinessException("Chọn ít nhất một phương thức thanh toán");
        requireCourse(courseId);
        activeAccount(x.paymentAccountId());
        jdbc.update("""
          insert into course_fee_policies(course_instance_id,payment_account_id,calculation,unit_price,discount_amount,installments,first_due_date,period_months,prorate,bank_qr,cash,updated_by)
          values(?,?,?,?,?,?,?,?,?,?,?,?) on conflict(course_instance_id) do update set
          payment_account_id=excluded.payment_account_id,calculation=excluded.calculation,unit_price=excluded.unit_price,
          discount_amount=excluded.discount_amount,installments=excluded.installments,first_due_date=excluded.first_due_date,
          period_months=excluded.period_months,prorate=excluded.prorate,bank_qr=excluded.bank_qr,cash=excluded.cash,updated_by=excluded.updated_by,updated_at=now()
          """,courseId,x.paymentAccountId(),x.calculation(),x.unitPrice(),x.discountAmount(),x.installments(),x.firstDueDate(),x.periodMonths(),x.prorate(),x.bankQr(),x.cash(),current.requireUserId());
        audit.record("UPDATE_FEE_POLICY","COURSE_INSTANCE",courseId,null,"{\"updated\":true}");
        return ApiResponse.ok("Đã lưu chính sách; khoản thu đã lập giữ nguyên số tiền và tài khoản",null);
    }

    /** Xem trước bảng chia kỳ và số tiền từng học sinh, trước khi lập khoản thu. */
    @GetMapping("/courses/{courseId}/fees/preview")
    public ApiResponse<FeeDraftService.Preview> preview(@PathVariable long courseId) {
        return ApiResponse.ok("Học phí dự kiến",drafts.preview(courseId));
    }

    /** mode=ADD chỉ thêm học sinh chưa có khoản thu; mode=SYNC lập lại khoản nháp đã lệch khi lớp đổi. */
    @PostMapping("/courses/{courseId}/fees") @Transactional
    public ApiResponse<FeeDraftService.SyncResult> generate(@PathVariable long courseId,
        @RequestParam(defaultValue="ADD") String mode) {
        var r=drafts.generate(courseId,"SYNC".equals(mode));
        return ApiResponse.created("Đã lập "+r.rows()+" khoản thu nháp",r);
    }

    private static final String FEE_SELECT="""
      select f.*,u.full_name student_name,c.name course_name,a.name account_name,a.beneficiary_name,a.bank_name,a.bank_code,a.account_number,a.account_holder,a.qr_template,a.status account_status,
      coalesce(t.paid,0) paid_amount,f.amount-coalesce(t.paid,0) outstanding,
      case when f.status in ('CONFIRMED','PARTIALLY_PAID') and f.due_date<current_date then 'OVERDUE' else f.status end display_status,
      exists(select 1 from payment_transactions tx where tx.student_fee_id=f.id and tx.status in ('PENDING','PROCESSING')) pending_confirmation
      from student_fees f join users u on u.id=f.student_id join course_instances c on c.id=f.course_instance_id
      join payment_accounts a on a.id=f.payment_account_id
      left join (select student_fee_id,sum(amount) paid from payment_transactions where status='SUCCESS' group by student_fee_id) t on t.student_fee_id=f.id
      """;
    @GetMapping("/fees")
    public ApiResponse<List<Map<String,Object>>> fees(@RequestParam(required=false) Long courseId) {
        return ApiResponse.ok("Khoản phải thu",courseId==null?jdbc.queryForList(FEE_SELECT+" order by f.id desc"):
            jdbc.queryForList(FEE_SELECT+" where f.course_instance_id=? order by f.id desc",courseId));
    }
    @GetMapping("/my-fees") @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<Map<String,Object>>> myFees() {
        return ApiResponse.ok("Học phí của em",jdbc.queryForList(FEE_SELECT+" where f.student_id=? and f.status<>'DRAFT' order by f.due_date,f.id",current.requireUserId()));
    }
    @PostMapping("/fees/{id}/publish") @Transactional
    public ApiResponse<Void> publish(@PathVariable long id) {
        var f=lockFee(id); if(!"DRAFT".equals(f.get("status")))throw new BusinessException("Chỉ xác nhận khoản thu nháp");
        activeAccount(number(f,"payment_account_id"));
        jdbc.update("update student_fees set status='CONFIRMED',confirmed_by=?,confirmed_at=now(),updated_at=now() where id=?",current.requireUserId(),id);
        audit.record("CONFIRM_STUDENT_FEE","STUDENT_FEE",id,null,"{\"status\":\"CONFIRMED\"}");
        return ApiResponse.ok("Học sinh đã có thể xem khoản cần đóng",null);
    }
    @PostMapping("/fees/{id}/cancel") @Transactional
    public ApiResponse<Void> cancel(@PathVariable long id) {
        lockFee(id);
        if(jdbc.queryForObject("select count(*) from payment_transactions where student_fee_id=? and status in ('SUCCESS','PENDING','PROCESSING')",Integer.class,id)>0)
            throw new BusinessException("Khoản thu đã có giao dịch, cần đối soát trước khi hủy");
        jdbc.update("update student_fees set status='CANCELLED',updated_at=now() where id=?",id);
        audit.record("CANCEL_STUDENT_FEE","STUDENT_FEE",id,null,"{\"status\":\"CANCELLED\"}");
        return ApiResponse.ok("Đã hủy khoản thu",null);
    }

    @PostMapping("/fees/{id}/transactions") @PreAuthorize("hasAnyRole('ADMIN','STUDENT')") @Transactional
    public ApiResponse<Long> report(@PathVariable long id,@Valid @RequestBody TransactionInput x) {
        var f=lockFee(id);
        boolean student="STUDENT".equals(current.requireRoleCode());
        if(student&&number(f,"student_id")!=current.requireUserId())throw new AccessDeniedException("Không có quyền xem khoản học phí này");
        if(!Set.of("CONFIRMED","PARTIALLY_PAID").contains(f.get("status")))throw new BusinessException("Khoản thu chưa được xác nhận hoặc đã kết thúc");
        if(student&&"CASH".equals(x.method()))throw new BusinessException("Tiền mặt cần được quản trị ghi nhận tại quầy");
        if(!Boolean.TRUE.equals(f.get("BANK_QR".equals(x.method())?"bank_qr":"cash")))throw new BusinessException("Phương thức này không được bật cho khoản thu");
        activeAccount(number(f,"payment_account_id"));
        if(x.amount().compareTo(outstanding(f))>0)throw new BusinessException("Số tiền vượt quá khoản còn phải đóng");
        var pending=jdbc.queryForList("select id from payment_transactions where student_fee_id=? and status in ('PENDING','PROCESSING')",id);
        if(!pending.isEmpty())throw new BusinessException("Khoản thu đang có giao dịch chờ đối soát");
        Long tx=jdbc.queryForObject("""
          insert into payment_transactions(student_fee_id,payment_account_id,payment_reference,amount,method,status,note,created_by)
          values(?,?,?,?,?,'PROCESSING',?,?) returning id
          """,Long.class,id,f.get("payment_account_id"),f.get("payment_reference"),x.amount(),x.method(),x.note(),current.requireUserId());
        event(tx,"REPORTED",x.note());
        return ApiResponse.created("Đã gửi thông tin, đang chờ xác nhận nhận tiền",tx);
    }
    @GetMapping("/transactions")
    public ApiResponse<List<Map<String,Object>>> transactions() {
        return ApiResponse.ok("Giao dịch",jdbc.queryForList("""
          select t.*,u.full_name student_name,f.title,f.amount fee_amount,a.bank_name,a.account_number,
          confirmer.full_name confirmed_by_name from payment_transactions t join student_fees f on f.id=t.student_fee_id
          join users u on u.id=f.student_id join payment_accounts a on a.id=t.payment_account_id
          left join users confirmer on confirmer.id=t.confirmed_by order by t.created_at desc
          """));
    }
    @PostMapping("/transactions/{id}/confirm") @Transactional
    public ApiResponse<Void> confirm(@PathVariable long id,@Valid @RequestBody ConfirmationInput x) {
        var initial=transaction(id); var f=lockFee(number(initial,"student_fee_id")); var tx=transaction(id);
        if("SUCCESS".equals(tx.get("status"))) {
            if(!x.transactionReference().trim().equals(tx.get("provider_transaction_id")))throw new BusinessException("Giao dịch đã xác nhận với mã đối soát khác");
            return ApiResponse.ok("Giao dịch đã được xác nhận trước đó",null);
        }
        if(!Set.of("PROCESSING","PENDING").contains(tx.get("status")))throw new BusinessException("Giao dịch không còn chờ xác nhận");
        if(!Set.of("CONFIRMED","PARTIALLY_PAID").contains(f.get("status")))throw new BusinessException("Khoản thu không thể nhận thêm thanh toán");
        if("CASH".equals(tx.get("method")) != "CASH_RECEIPT".equals(x.confirmationMethod()))throw new BusinessException("Phương thức đối soát không khớp giao dịch");
        BigDecimal amount=money(tx,"amount");
        if(amount.compareTo(outstanding(f))>0)throw new BusinessException("Giao dịch vượt khoản còn phải đóng, cần kiểm tra");
        if(jdbc.queryForObject("select count(*) from payment_transactions where payment_account_id=? and provider='MANUAL' and provider_transaction_id=?",Integer.class,tx.get("payment_account_id"),x.transactionReference().trim())>0)
            throw new BusinessException("Mã giao dịch ngân hàng hoặc số phiếu thu đã được đối soát");
        jdbc.update("""
          update payment_transactions set status='SUCCESS',provider_transaction_id=?,paid_at=now(),confirmed_at=now(),confirmed_by=?,confirmation_method=?,note=?,updated_at=now() where id=?
          """,x.transactionReference().trim(),current.requireUserId(),x.confirmationMethod(),x.note(),id);
        String status=outstanding(f).signum()==0?"PAID":"PARTIALLY_PAID";
        jdbc.update("update student_fees set status=?,updated_at=now() where id=?",status,f.get("id"));
        event(id,"CONFIRMED",x.note());
        audit.record("CONFIRM_PAYMENT","PAYMENT_TRANSACTION",id,"{\"status\":\"PROCESSING\"}","{\"status\":\"SUCCESS\"}");
        return ApiResponse.ok("Đã xác nhận nhận tiền",null);
    }
    @PostMapping("/transactions/{id}/reject") @Transactional
    public ApiResponse<Void> reject(@PathVariable long id,@RequestBody Map<String,String> body) {
        var first=transaction(id);lockFee(number(first,"student_fee_id"));var tx=transaction(id);
        String note=body.getOrDefault("note","").trim();
        if(note.isEmpty()||note.length()>1000)throw new BusinessException("Nhập lý do từ chối, tối đa 1000 ký tự");
        if(!Set.of("PROCESSING","PENDING").contains(tx.get("status")))throw new BusinessException("Giao dịch không còn chờ đối soát");
        jdbc.update("update payment_transactions set status='FAILED',note=?,updated_at=now() where id=?",note,id);
        event(id,"REJECTED",note);
        audit.record("REJECT_PAYMENT","PAYMENT_TRANSACTION",id,null,"{\"status\":\"FAILED\"}");
        return ApiResponse.ok("Đã ghi nhận kết quả đối soát",null);
    }
    @GetMapping("/transactions/{id}/events")
    public ApiResponse<List<Map<String,Object>>> events(@PathVariable long id) {
        return ApiResponse.ok("Nhật ký xác nhận",jdbc.queryForList("select e.*,u.full_name actor_name from payment_confirmation_events e join users u on u.id=e.actor_id where transaction_id=? order by e.id",id));
    }
    private Map<String,Object> transaction(long id) {
        var rows=jdbc.queryForList("select * from payment_transactions where id=?",id);
        if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy giao dịch");return rows.get(0);
    }
    private Map<String,Object> lockFee(long id) {
        var rows=jdbc.queryForList("select * from student_fees where id=? for update",id);
        if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy khoản thu");return rows.get(0);
    }
    private BigDecimal outstanding(Map<String,Object> f) {
        BigDecimal paid=jdbc.queryForObject("select coalesce(sum(amount),0) from payment_transactions where student_fee_id=? and status='SUCCESS'",BigDecimal.class,f.get("id"));
        return money(f,"amount").subtract(paid);
    }
    private void activeAccount(long id) {
        if(jdbc.queryForObject("select count(*) from payment_accounts where id=? and status='ACTIVE'",Integer.class,id)!=1)throw new BusinessException("Tài khoản nhận tiền không hoạt động");
    }
    private void requireCourse(long id) {
        if(jdbc.queryForObject("select count(*) from course_instances where id=? and deleted_at is null",Integer.class,id)!=1)throw new ResourceNotFoundException("Không tìm thấy khóa học");
    }
    private void event(long tx,String action,String note) {jdbc.update("insert into payment_confirmation_events(transaction_id,action,actor_id,note) values(?,?,?,?)",tx,action,current.requireUserId(),note);}
    private static long number(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static BigDecimal money(Map<String,Object> row,String key){return (BigDecimal)row.get(key);}
}
