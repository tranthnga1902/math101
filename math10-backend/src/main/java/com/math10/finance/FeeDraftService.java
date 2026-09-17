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

@Service
@RequiredArgsConstructor
public class FeeDraftService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    @Transactional
    public int generate(long courseId) {
        requireCourse(courseId);
        var policies=jdbc.queryForList("select * from course_fee_policies where course_instance_id=? for update",courseId);
        if(policies.isEmpty())throw new BusinessException("Khóa học chưa có chính sách học phí");
        var p=policies.get(0); activeAccount(number(p,"payment_account_id"));
        int count="PER_SESSION".equals(p.get("calculation"))?jdbc.queryForObject("select count(*) from course_delivery_sessions where course_instance_id=? and deleted_at is null",Integer.class,courseId):1;
        if(count==0)throw new BusinessException("Cần tạo buổi học trước khi lập học phí theo buổi");
        BigDecimal total=money(p,"unit_price").multiply(BigDecimal.valueOf(count)).subtract(money(p,"discount_amount"));
        int installments=((Number)p.get("installments")).intValue();
        if(total.compareTo(BigDecimal.valueOf(installments))<0)throw new BusinessException("Học phí sau giảm phải đủ để chia các kỳ, mỗi kỳ tối thiểu 1 đồng");
        BigDecimal base=total.divide(BigDecimal.valueOf(installments),0,RoundingMode.DOWN);
        LocalDate due=((java.sql.Date)p.get("first_due_date")).toLocalDate();
        String name=jdbc.queryForObject("select name from course_instances where id=?",String.class,courseId);
        List<Long> students=jdbc.queryForList("""
          select distinct cs.student_id from class_students cs join class_courses cc on cc.class_id=cs.class_id
          join classes c on c.id=cs.class_id and c.deleted_at is null
          join users u on u.id=cs.student_id and u.deleted_at is null and u.role_code='STUDENT'
          where cc.course_instance_id=? and cc.deleted_at is null and cs.deleted_at is null
          """,Long.class,courseId);
        int added=0;
        for(long student:students) {
            if(jdbc.queryForObject("select count(*) from student_fees where course_instance_id=? and student_id=?",Integer.class,courseId,student)>0)continue;
            for(int i=1;i<=installments;i++) {
                Long id=jdbc.queryForObject("select nextval(pg_get_serial_sequence('student_fees','id'))",Long.class);
                BigDecimal amount=i==installments?total.subtract(base.multiply(BigDecimal.valueOf(installments-1))):base;
                String ref="HP-"+LocalDate.now().getYear()+"-"+String.format(Locale.ROOT,"%06d",id);
                jdbc.update("""
                  insert into student_fees(id,course_instance_id,student_id,payment_account_id,title,installment_no,amount,due_date,payment_reference,bank_qr,cash)
                  values(?,?,?,?,?,?,?,?,?,?,?)
                  """,id,courseId,student,p.get("payment_account_id"),"Học phí "+name+" · Kỳ "+i,i,amount,due.plusMonths((long)(i-1)*((Number)p.get("period_months")).intValue()),ref,p.get("bank_qr"),p.get("cash"));
                added++;
            }
        }
        audit.record("GENERATE_FEES","COURSE_INSTANCE",courseId,null,"{\"created\":"+added+"}");
        return added;
    }
    @Transactional
    public void forClass(long classId) {
        for(Long course:jdbc.queryForList("select distinct cc.course_instance_id from class_courses cc join course_fee_policies p on p.course_instance_id=cc.course_instance_id where cc.class_id=? and cc.deleted_at is null order by cc.course_instance_id",Long.class,classId)) {
            generate(course);
        }
    }
    private void activeAccount(long id) {
        if(jdbc.queryForObject("select count(*) from payment_accounts where id=? and status='ACTIVE'",Integer.class,id)!=1)throw new BusinessException("Tài khoản nhận tiền không hoạt động");
    }
    private void requireCourse(long id) {
        if(jdbc.queryForObject("select count(*) from course_instances where id=? and deleted_at is null",Integer.class,id)!=1)throw new ResourceNotFoundException("Không tìm thấy khóa học");
    }

    private static long number(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static BigDecimal money(Map<String,Object> row,String key){return (BigDecimal)row.get(key);}
}
