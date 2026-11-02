package com.math10.finance;
import com.math10.audit.service.AuditService;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * Tính học phí và chia kỳ. Một chỗ duy nhất tính ra số tiền: {@link #plan(Map, Map)}.
 * Xem trước, lập mới và lập lại đều đi qua hàm đó nên bảng xem trước luôn đúng bằng khoản thu sẽ lập.
 */
@Service
@RequiredArgsConstructor
public class FeeDraftService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    /** Một kỳ đóng: số tiền và hạn đóng. */
    public record Installment(int no,BigDecimal amount,LocalDate dueDate) {}
    /**
     * Khoản thu dự kiến của một học sinh.
     * state: MOI chưa có khoản thu · DOI số tiền đổi, khoản nháp sẽ lập lại ·
     * GIU_NGUYEN đã khớp · KHOA đã xác nhận hoặc đã có giao dịch, không đụng tới.
     */
    public record StudentPlan(long studentId,String studentName,Long classId,String className,
        LocalDate joinedOn,int sessions,BigDecimal total,List<Installment> installments,String state,String note) {}
    /** Kết quả xem trước cho cả khóa. */
    public record Preview(int courseSessions,boolean prorate,String calculation,int installments,
        BigDecimal unitPrice,BigDecimal discountAmount,List<Installment> sample,List<StudentPlan> students,
        int newCount,int changedCount,int unchangedCount,int lockedCount) {}
    /** Kết quả sau khi lập hoặc lập lại. */
    public record SyncResult(int added,int rebuilt,int locked,int unchanged,int rows) {}

    @Transactional(readOnly=true)
    public Preview preview(long courseId) {
        requireCourse(courseId);
        var p=policy(courseId,false);
        var students=new ArrayList<StudentPlan>();
        int news=0,changed=0,same=0,locked=0;
        for(var s:enrolled(courseId)) {
            var plan=plan(p,s);
            students.add(plan);
            switch(plan.state()) { case "MOI"->news++; case "DOI"->changed++; case "KHOA"->locked++; default->same++; }
        }
        int courseSessions=courseSessions(courseId);
        return new Preview(courseSessions,bool(p,"prorate"),(String)p.get("calculation"),
            intOf(p,"installments"),money(p,"unit_price"),money(p,"discount_amount"),
            split(totalFor(p,courseSessions),p),students,news,changed,same,locked);
    }

    /** Lập khoản thu. sync=false chỉ thêm học sinh chưa có; sync=true lập lại cả khoản nháp đã lệch. */
    @Transactional
    public SyncResult generate(long courseId,boolean sync) {
        requireCourse(courseId);
        var p=policy(courseId,true);
        activeAccount(number(p,"payment_account_id"));
        String name=jdbc.queryForObject("select name from course_instances where id=?",String.class,courseId);
        int added=0,rebuilt=0,locked=0,unchanged=0,rows=0;
        for(var s:enrolled(courseId)) {
            var plan=plan(p,s);
            if("KHOA".equals(plan.state())) { locked++; continue; }
            if("GIU_NGUYEN".equals(plan.state())) { unchanged++; continue; }
            if("DOI".equals(plan.state())) {
                if(!sync) { unchanged++; continue; }
                jdbc.update("delete from student_fees where course_instance_id=? and student_id=?",courseId,plan.studentId());
                rebuilt++;
            } else added++;
            for(var it:plan.installments()) {
                Long id=jdbc.queryForObject("select nextval(pg_get_serial_sequence('student_fees','id'))",Long.class);
                String ref="HP-"+LocalDate.now().getYear()+"-"+String.format(Locale.ROOT,"%06d",id);
                jdbc.update("""
                  insert into student_fees(id,course_instance_id,student_id,payment_account_id,title,installment_no,amount,due_date,payment_reference,bank_qr,cash,billable_sessions)
                  values(?,?,?,?,?,?,?,?,?,?,?,?)
                  """,id,courseId,plan.studentId(),p.get("payment_account_id"),"Học phí "+name+" · Kỳ "+it.no(),
                    it.no(),it.amount(),it.dueDate(),ref,p.get("bank_qr"),p.get("cash"),plan.sessions());
                rows++;
            }
        }
        audit.record(sync?"SYNC_FEES":"GENERATE_FEES","COURSE_INSTANCE",courseId,null,
            "{\"added\":"+added+",\"rebuilt\":"+rebuilt+",\"locked\":"+locked+"}");
        return new SyncResult(added,rebuilt,locked,unchanged,rows);
    }

    @Transactional
    public void forClass(long classId) {
        for(Long course:jdbc.queryForList("select distinct cc.course_instance_id from class_courses cc join course_fee_policies p on p.course_instance_id=cc.course_instance_id where cc.class_id=? and cc.deleted_at is null order by cc.course_instance_id",Long.class,classId)) {
            generate(course,false);
        }
    }

    /** Tính khoản thu của một học sinh: số buổi tính tiền, tổng tiền, các kỳ, và trạng thái so với khoản thu đã có. */
    private StudentPlan plan(Map<String,Object> p,Map<String,Object> s) {
        long courseId=number(p,"course_instance_id"), studentId=number(s,"student_id");
        Long classId=s.get("class_id")==null?null:number(s,"class_id");
        LocalDate joined=date(s,"joined_on");
        int courseSessions=courseSessions(courseId);
        int sessions=courseSessions; String note=null;
        if(bool(p,"prorate")&&"PER_SESSION".equals(p.get("calculation"))&&classId!=null) {
            int planned=jdbc.queryForObject("""
              select count(*) from class_schedule sch
              join course_delivery_sessions s2 on s2.id=sch.course_delivery_session_id and s2.deleted_at is null
              where sch.class_id=? and s2.course_instance_id=? and sch.deleted_at is null and sch.status<>'CANCELLED'
              """,Integer.class,classId,courseId);
            if(planned==0) note="Lớp chưa xếp lịch ngày nên tạm tính đủ "+courseSessions+" buổi";
            else {
                int left=jdbc.queryForObject("""
                  select count(*) from class_schedule sch
                  join course_delivery_sessions s2 on s2.id=sch.course_delivery_session_id and s2.deleted_at is null
                  where sch.class_id=? and s2.course_instance_id=? and sch.deleted_at is null
                    and sch.status<>'CANCELLED' and sch.scheduled_date>=?
                  """,Integer.class,classId,courseId,joined);
                sessions=left;
                if(left<planned) note="Vào lớp từ "+joined+", còn "+left+"/"+planned+" buổi";
            }
        }
        BigDecimal total=totalFor(p,sessions);
        var installments=split(total,p);
        var existing=jdbc.queryForList("select installment_no,amount,due_date,status,billable_sessions from student_fees where course_instance_id=? and student_id=? order by installment_no",courseId,studentId);
        String state=state(existing,installments,sessions,courseId,studentId);
        return new StudentPlan(studentId,(String)s.get("student_name"),classId,(String)s.get("class_name"),
            joined,sessions,total,installments,state,note);
    }

    private String state(List<Map<String,Object>> existing,List<Installment> want,int sessions,long courseId,long studentId) {
        if(existing.isEmpty())return "MOI";
        for(var row:existing) if(!"DRAFT".equals(row.get("status")))return "KHOA";
        if(jdbc.queryForObject("select count(*) from payment_transactions t join student_fees f on f.id=t.student_fee_id where f.course_instance_id=? and f.student_id=?",Integer.class,courseId,studentId)>0)return "KHOA";
        if(existing.size()!=want.size())return "DOI";
        for(int i=0;i<want.size();i++) {
            var row=existing.get(i); var it=want.get(i);
            if(intOf(row,"installment_no")!=it.no())return "DOI";
            if(money(row,"amount").compareTo(it.amount())!=0)return "DOI";
            if(!date(row,"due_date").equals(it.dueDate()))return "DOI";
            Object had=row.get("billable_sessions");
            if(had!=null&&((Number)had).intValue()!=sessions)return "DOI";
        }
        return "GIU_NGUYEN";
    }

    /** Chia tổng tiền thành các kỳ; kỳ cuối nhận phần lẻ. */
    private List<Installment> split(BigDecimal total,Map<String,Object> p) {
        int installments=intOf(p,"installments");
        if(total.compareTo(BigDecimal.valueOf(installments))<0)
            throw new BusinessException("Học phí sau giảm phải đủ để chia các kỳ, mỗi kỳ tối thiểu 1 đồng");
        BigDecimal base=total.divide(BigDecimal.valueOf(installments),0,RoundingMode.DOWN);
        LocalDate due=date(p,"first_due_date"); int months=intOf(p,"period_months");
        var out=new ArrayList<Installment>();
        for(int i=1;i<=installments;i++)
            out.add(new Installment(i,i==installments?total.subtract(base.multiply(BigDecimal.valueOf(installments-1))):base,
                due.plusMonths((long)(i-1)*months)));
        return out;
    }

    private BigDecimal totalFor(Map<String,Object> p,int sessions) {
        int count="PER_SESSION".equals(p.get("calculation"))?sessions:1;
        if(count==0)throw new BusinessException("Cần tạo buổi học trước khi lập học phí theo buổi");
        return money(p,"unit_price").multiply(BigDecimal.valueOf(count)).subtract(money(p,"discount_amount"));
    }

    private List<Map<String,Object>> enrolled(long courseId) {
        return jdbc.queryForList("""
          select distinct on (cs.student_id) cs.student_id,u.full_name student_name,c.id class_id,c.name class_name,
            coalesce(cs.joined_on,cs.created_at::date) joined_on
          from class_students cs
          join class_courses cc on cc.class_id=cs.class_id and cc.deleted_at is null
          join classes c on c.id=cs.class_id and c.deleted_at is null
          join users u on u.id=cs.student_id and u.deleted_at is null and u.role_code='STUDENT'
          where cc.course_instance_id=? and cs.deleted_at is null
          order by cs.student_id,c.id
          """,courseId);
    }

    private int courseSessions(long courseId) {
        return jdbc.queryForObject("select count(*) from course_delivery_sessions where course_instance_id=? and deleted_at is null",Integer.class,courseId);
    }
    private Map<String,Object> policy(long courseId,boolean lock) {
        var rows=jdbc.queryForList("select * from course_fee_policies where course_instance_id=?"+(lock?" for update":""),courseId);
        if(rows.isEmpty())throw new BusinessException("Khóa học chưa có chính sách học phí");
        return rows.get(0);
    }
    private void activeAccount(long id) {
        if(jdbc.queryForObject("select count(*) from payment_accounts where id=? and status='ACTIVE'",Integer.class,id)!=1)throw new BusinessException("Tài khoản nhận tiền không hoạt động");
    }
    private void requireCourse(long id) {
        if(jdbc.queryForObject("select count(*) from course_instances where id=? and deleted_at is null",Integer.class,id)!=1)throw new ResourceNotFoundException("Không tìm thấy khóa học");
    }

    private static long number(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static int intOf(Map<String,Object> row,String key){return ((Number)row.get(key)).intValue();}
    private static boolean bool(Map<String,Object> row,String key){return Boolean.TRUE.equals(row.get(key));}
    private static BigDecimal money(Map<String,Object> row,String key){return (BigDecimal)row.get(key);}
    private static LocalDate date(Map<String,Object> row,String key){
        Object v=row.get(key);
        return v instanceof java.sql.Date d?d.toLocalDate():(LocalDate)v;
    }
}
