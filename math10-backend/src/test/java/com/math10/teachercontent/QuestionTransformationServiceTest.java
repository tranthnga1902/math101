package com.math10.teachercontent;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest @ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class QuestionTransformationServiceTest {
 @Autowired JdbcTemplate jdbc; @Autowired QuestionTransformationService service;
 @Test void generatesTenValidVariantsForEveryCoreRule(){
  long teacher=jdbc.queryForObject("insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at) values(?,'x','T',?,'TEACHER','ACTIVE',now(),now()) returning id",Long.class,"transform"+System.nanoTime()+"@test.local","transform"+System.nanoTime());
  long source=jdbc.queryForObject("insert into teacher_source_documents(owner_teacher_id,title,file_type,storage_key,original_filename,status,created_at,updated_at) values(?,'x','TXT','x','x.txt','PARSED',now(),now()) returning id",Long.class,teacher);
  long linear=question(source,"LINEAR_EQUATION","SOLVE_EQUATION"),quadratic=question(source,"QUADRATIC_EQUATION","SOLVE_EQUATION"),lineFunction=question(source,"LINEAR_FUNCTION","FIND_ROOT"),quadFunction=question(source,"QUADRATIC_FUNCTION","FIND_VERTEX");
  for(long q:List.of(linear,quadratic,lineFunction,quadFunction))for(int i=0;i<10;i++)assertThat(service.transform(q,teacher,Map.of("type","PARAMETER_CHANGE")).get("validation_status")).isEqualTo("VALID");
  assertThat(jdbc.queryForObject("select count(*) from question_transformations where created_by=?",Integer.class,teacher)).isEqualTo(40);
  assertThat(jdbc.queryForObject("select count(*) from question_variants where validation_status='VALID' and source_question_id in (?,?,?,?)",Integer.class,linear,quadratic,lineFunction,quadFunction)).isEqualTo(40);
 }
 private long question(long source,String signature,String intent){return jdbc.queryForObject("insert into extracted_questions(source_document_id,question_text,confidence,status,transform_level,question_type,math_signature,signature_confidence,question_intent,intent_confidence,math_parse_valid,structure_valid,transformable,created_at,updated_at) values(?,'Question',.95,'REVIEWED','LEVEL_2','FREE_RESPONSE',?,.95,?,.95,true,true,true,now(),now()) returning id",Long.class,source,signature,intent);}
}
