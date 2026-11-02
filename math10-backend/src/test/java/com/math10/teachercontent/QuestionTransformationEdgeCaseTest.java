package com.math10.teachercontent;

import com.math10.common.exception.BusinessException;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Hai ca biên mà QuestionTransformationServiceTest không với tới được, vì phép thử đó ghi thẳng
 * math_signature vào CSDL nên không đi qua QuestionMathAnalysisService, và chỉ dùng tham số ngẫu
 * nhiên nên không ép được giá trị 0.
 */
@SpringBootTest @ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class QuestionTransformationEdgeCaseTest {
 @Autowired JdbcTemplate jdbc; @Autowired QuestionTransformationService service; @Autowired QuestionMathAnalysisService analysis;

 /** Đáp án bằng 0: "x = 0" và "x = -0" trùng nhau, phải lấy ứng viên dự phòng chứ không chắp chuỗi. */
 @Test void zeroAnswerStillGivesFourRealDistractors(){
  long teacher=teacher("zero"),source=source(teacher);
  long q=question(source,"LINEAR_EQUATION","SOLVE_EQUATION");
  Map<String,Object> variant=service.transform(q,teacher,Map.of("a",2,"b",3,"xSolution",0));
  String options=variant.get("options_json").toString();
  assertThat(variant.get("answer")).isEqualTo("x = 0");
  assertThat(variant.get("content")).isEqualTo("Giải phương trình 2x + 3 = 3");
  assertThat(options).doesNotContain(" + 1\"").doesNotContain("0 + ");
  assertThat(options).contains("x = 0").contains("x = 1").contains("x = -1").contains("x = 2");
  assertThat(variant.get("validation_status")).isEqualTo("VALID");
 }

 /** Đỉnh (0, 0): cả bốn phương án cũ đều rút về một chuỗi, nên đây là ca tệ nhất của lỗi trên. */
 @Test void zeroVertexStillGivesFourRealDistractors(){
  long teacher=teacher("vertex"),source=source(teacher);
  long q=question(source,"QUADRATIC_FUNCTION","FIND_VERTEX");
  Map<String,Object> variant=service.transform(q,teacher,Map.of("a",1,"h",0,"k",0));
  String options=variant.get("options_json").toString();
  assertThat(variant.get("answer")).isEqualTo("(0, 0)");
  assertThat(options).doesNotContain(" + 1\"").doesNotContain(") + ");
  assertThat(options).contains("(0, 0)").contains("(1, 0)").contains("(0, 1)").contains("(1, 1)");
  assertThat(variant.get("validation_status")).isEqualTo("VALID");
 }

 /** sin(x) lọt cổng chặn thành LINEAR_EXPRESSION, nhưng engine không có rule nên ném lỗi. */
 @Test void trigonometryPassesGateThenEngineRefuses(){
  long teacher=teacher("trig"),source=source(teacher);
  long q=jdbc.queryForObject("insert into extracted_questions(source_document_id,question_text,confidence,status,transform_level,question_type,created_at,updated_at) values(?,'Tìm hệ số của sin(x)',.95,'REVIEWED','LEVEL_0','TU_LUAN',now(),now()) returning id",Long.class,source);
  jdbc.update("insert into math_fragments(question_id,raw_value,latex_value,order_index,status,confidence,review_decision,created_at,updated_at) values(?,'sin(x)','sin(x)',1,'REVIEWED',.95,'ACCEPTED',now(),now())",q);

  var a=analysis.analyze(q);
  assertThat(a.signature()).isEqualTo("LINEAR_EXPRESSION");
  assertThat(a.intent()).isEqualTo("IDENTIFY_COEFFICIENT");
  assertThat(a.transformable()).isTrue();
  assertThat(jdbc.queryForObject("select transform_level from extracted_questions where id=?",String.class,q)).isEqualTo("LEVEL_2");

  assertThatThrownBy(()->service.transform(q,teacher,Map.of()))
    .isInstanceOf(BusinessException.class).hasMessageContaining("chưa có rule biến đổi");
 }

 private long teacher(String tag){return jdbc.queryForObject("insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at) values(?,'x','T',?,'TEACHER','ACTIVE',now(),now()) returning id",Long.class,tag+System.nanoTime()+"@test.local",tag+System.nanoTime());}
 private long source(long teacher){return jdbc.queryForObject("insert into teacher_source_documents(owner_teacher_id,title,file_type,storage_key,original_filename,status,created_at,updated_at) values(?,'x','TXT','x','x.txt','PARSED',now(),now()) returning id",Long.class,teacher);}
 private long question(long source,String signature,String intent){return jdbc.queryForObject("insert into extracted_questions(source_document_id,question_text,confidence,status,transform_level,question_type,math_signature,signature_confidence,question_intent,intent_confidence,math_parse_valid,structure_valid,transformable,created_at,updated_at) values(?,'Question',.95,'REVIEWED','LEVEL_2','TU_LUAN',?,.95,?,.95,true,true,true,now(),now()) returning id",Long.class,source,signature,intent);}
}
