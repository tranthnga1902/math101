package com.math10.finance;

import com.math10.configuration.security.Math10Principal;
import com.math10.common.exception.BusinessException;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FinanceFlowTest {
 @Autowired JdbcTemplate jdbc;
 @Autowired FinanceController finance;
 long admin,student,other,course;
 @BeforeAll void setup() {
  admin=user("ADMIN");student=user("STUDENT");other=user("STUDENT");
  long program=jdbc.queryForObject("insert into courses(code,name,status,created_at,updated_at) values('FEE-TEST','Finance','PUBLISHED',now(),now()) returning id",Long.class);
  long template=jdbc.queryForObject("insert into program_templates(program_id,name,status,created_at,updated_at) values(?,'Finance','PUBLISHED',now(),now()) returning id",Long.class,program);
  course=jdbc.queryForObject("insert into course_instances(template_id,name,school_year,starts_on,ends_on,status,created_at,updated_at) values(?,'Khóa tài chính','2026-2027','2026-09-01','2027-06-01','PUBLISHED',now(),now()) returning id",Long.class,template);
  long grade=jdbc.queryForObject("select id from grades order by id limit 1",Long.class);
  long classroom=jdbc.queryForObject("insert into classes(code,name,grade_id,status,created_at,updated_at) values('FINANCE-CLASS','Lớp tài chính',?,'ACTIVE',now(),now()) returning id",Long.class,grade);
  jdbc.update("insert into class_students(class_id,student_id,created_at,updated_at) values(?,?,now(),now())",classroom,student);
  jdbc.update("insert into class_courses(class_id,course_instance_id,created_at,updated_at) values(?,?,now(),now())",classroom,course);
 }
 long user(String role){String name=role+java.util.UUID.randomUUID().toString().substring(0,8);return jdbc.queryForObject("insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at) values(?,'unused',?,?,?,'ACTIVE',now(),now()) returning id",Long.class,name+"@example.test",name,name,role);}
 void as(long user,String role){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new Math10Principal(user,"finance@example.test",role),null,List.of(new SimpleGrantedAuthority("ROLE_"+role))));}
 @BeforeEach void login(){as(admin,"ADMIN");}
 @AfterEach void logout(){SecurityContextHolder.clearContext();}
 long account(){return finance.account(new FinanceController.AccountInput("Học phí","Trung tâm kiểm thử","970415","Vietinbank","123456789","TEST ACCOUNT","compact2")).data();}
 List<Map<String,Object>> createFees(int installments){long account=account();finance.policy(course,new FinanceController.PolicyInput(account,"FIXED",new BigDecimal("1001"),BigDecimal.ZERO,installments,LocalDate.now().minusDays(1),1,true,true));finance.generate(course);return finance.fees(course).data();}
 long id(Map<String,Object> f){return ((Number)f.get("id")).longValue();}
 FinanceController.ConfirmationInput confirmation(String ref){return new FinanceController.ConfirmationInput(ref,"BANK_RECONCILIATION","Đã kiểm tra sao kê ngân hàng");}

 @Test @Transactional void chiaKyKhongMatTienVaKhongLapTrung() {
  var fees=createFees(3);
  assertThat(fees).hasSize(3);
  assertThat(fees.stream().map(f->(BigDecimal)f.get("amount")).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("1001");
  assertThat(fees).extracting(f->f.get("payment_reference")).doesNotHaveDuplicates();
  assertThat(finance.generate(course).data()).isZero();
  as(student,"STUDENT");assertThat(finance.myFees().data()).isEmpty();
 }
 @Test @Transactional void hocSinhBaoChuyenTienChuaDuocTinhLaDaDong() {
  long fee=id(createFees(1).get(0));finance.publish(fee);
  as(student,"STUDENT");long tx=finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("400"),"BANK_QR","Đã chuyển")).data();
  assertThat(finance.myFees().data().get(0)).containsEntry("status","CONFIRMED").containsEntry("pending_confirmation",true);
  assertThat((BigDecimal)finance.myFees().data().get(0).get("paid_amount")).isEqualByComparingTo("0");
  assertThatThrownBy(()->finance.confirm(tx,confirmation("BANK1"))).isInstanceOf(AccessDeniedException.class);
  assertThatThrownBy(()->finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("400"),"BANK_QR","Lần hai"))).isInstanceOf(BusinessException.class);
 }
 @Test @Transactional void doiSoatMotPhanVaDuTienIdempotentCoNhatKy() {
  long fee=id(createFees(1).get(0));finance.publish(fee);
  long tx=finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("400"),"BANK_QR","Đã chuyển")).data();
  finance.confirm(tx,confirmation("BANK-PARTIAL"));finance.confirm(tx,confirmation("BANK-PARTIAL"));
  assertThat(finance.fees(course).data().get(0)).containsEntry("status","PARTIALLY_PAID");
  assertThat(finance.events(tx).data()).hasSize(2);
  assertThat(finance.transactions().data().get(0)).containsEntry("confirmed_by",admin).containsEntry("confirmation_method","BANK_RECONCILIATION");
  long tx2=finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("601"),"BANK_QR","")).data();
  finance.confirm(tx2,confirmation("BANK-FINAL"));
  assertThat(finance.fees(course).data().get(0)).containsEntry("status","PAID");
  assertThat((BigDecimal)finance.fees(course).data().get(0).get("outstanding")).isEqualByComparingTo("0");
  assertThatThrownBy(()->finance.cancel(fee)).isInstanceOf(BusinessException.class);
 }
 @Test @Transactional void chanKhoanCuaNguoiKhacVaSoTienVuotMuc() {
  long fee=id(createFees(1).get(0));finance.publish(fee);
  as(other,"STUDENT");assertThat(finance.myFees().data()).isEmpty();
  assertThatThrownBy(()->finance.report(fee,new FinanceController.TransactionInput(BigDecimal.ONE,"BANK_QR","")).data()).isInstanceOf(AccessDeniedException.class);
  as(student,"STUDENT");
  assertThatThrownBy(()->finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("1002"),"BANK_QR","")).data()).isInstanceOf(BusinessException.class);
  assertThatThrownBy(()->finance.report(fee,new FinanceController.TransactionInput(BigDecimal.ONE,"CASH","")).data()).isInstanceOf(BusinessException.class);
 }
 @Test @Transactional void tuChoiDoiSoatKhongCongTienVaChoPhepBaoLai() {
  long fee=id(createFees(1).get(0));finance.publish(fee);
  long tx=finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("1001"),"BANK_QR","")).data();
  finance.reject(tx,Map.of("note","Không tìm thấy giao dịch trên sao kê"));
  assertThat((BigDecimal)finance.fees(course).data().get(0).get("paid_amount")).isEqualByComparingTo("0");
  assertThat(finance.report(fee,new FinanceController.TransactionInput(new BigDecimal("1001"),"BANK_QR","Gửi lại mã")).data()).isNotEqualTo(tx);
 }
 @Test @Transactional void doiChinhSachKhongSuaKhoanDaPhatHanh() {
  var original=createFees(1).get(0);long fee=id(original);finance.publish(fee);
  finance.policy(course,new FinanceController.PolicyInput(account(),"FIXED",new BigDecimal("5000"),BigDecimal.ZERO,2,LocalDate.now(),1,true,false));
  finance.generate(course);
  var fees=finance.fees(course).data();assertThat(fees).hasSize(1);
  assertThat(fees.get(0)).containsEntry("payment_account_id",original.get("payment_account_id"));
  assertThat((BigDecimal)fees.get(0).get("amount")).isEqualByComparingTo("1001");
 }
}
