package com.math10.teachercontent;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest @ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class QuestionMathAnalysisServiceTest {
 @Autowired JdbcTemplate jdbc; @Autowired QuestionMathAnalysisService analysis;
 @Test void detectsWhitelistSignaturesIntentsAndGate(){
  long teacher=jdbc.queryForObject("insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at) values('analysis@test.local','x','T','analysis-t','TEACHER','ACTIVE',now(),now()) returning id",Long.class);
  long source=jdbc.queryForObject("insert into teacher_source_documents(owner_teacher_id,title,file_type,storage_key,original_filename,status,created_at,updated_at) values(?,'x','TXT','x','x.txt','PARSED',now(),now()) returning id",Long.class,teacher);
  assertCase(source,"Giải phương trình 2x + 3 = 11","2x+3=11","LINEAR_EQUATION","SOLVE_EQUATION",true);
  assertCase(source,"Tìm đỉnh của hàm số y = 2x^2 - 4x + 1","y=2x^2-4x+1","QUADRATIC_FUNCTION","FIND_VERTEX",true);
  assertCase(source,"Tính biểu thức sin(x)","sin(x)","LINEAR_EXPRESSION","UNKNOWN",false);
 }
 private void assertCase(long source,String stem,String math,String signature,String intent,boolean expected){
  long q=jdbc.queryForObject("insert into extracted_questions(source_document_id,question_text,confidence,status,transform_level,question_type,created_at,updated_at) values(?,? ,.95,'REVIEWED','LEVEL_0','TU_LUAN',now(),now()) returning id",Long.class,source,stem);
  jdbc.update("insert into math_fragments(question_id,raw_value,latex_value,order_index,status,confidence,review_decision,created_at,updated_at) values(?,?,?,1,'REVIEWED',.95,'ACCEPTED',now(),now())",q,math,math);
  var a=analysis.analyze(q);assertThat(a.signature()).isEqualTo(signature);assertThat(a.intent()).isEqualTo(intent);assertThat(a.transformable()).isEqualTo(expected);
 }
}
