package com.math10.teachercontent;
import com.math10.common.storage.R2StorageServiceImpl;
import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.charset.StandardCharsets;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class TeacherContentPipelineTest {
 @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @MockBean R2StorageServiceImpl storage;
 long teacher,other;
 @BeforeEach void setup() throws Exception {teacher=user("pipeline-a");other=user("pipeline-b");when(storage.upload(any(),anyString())).thenReturn("teacher-sources/source.txt");}
 @Test void uploadParseReviewTransformComposeAndOwnership()throws Exception{
  var sourceText="Cau 1. Solve x^2 - 5x + 6 = 0\nA. 1, 6\nB. 2, 3\nC. 0, 5\nD. -2, -3\nAnswer: B\nSolution: Factorize";
  var file=new MockMultipartFile("file","ham-so.txt","text/plain",sourceText.getBytes(StandardCharsets.UTF_8));
  assertThat(mvc.perform(multipart("/api/teacher/content-pipeline/sources").file(file).param("title","Ham so").with(authentication(auth(teacher)))).andReturn().getResponse().getStatus()).isEqualTo(200);
  long source=jdbc.queryForObject("select id from teacher_source_documents where owner_teacher_id=? order by id desc limit 1",Long.class,teacher);
  long q=jdbc.queryForObject("select id from extracted_questions where source_document_id=?",Long.class,source);
  assertThat(jdbc.queryForObject("select count(*) from document_blocks where source_document_id=?",Integer.class,source)).isGreaterThan(0);
  assertThat(jdbc.queryForObject("select count(*) from math_fragments where question_id=?",Integer.class,q)).isGreaterThan(0);
  assertThat(jdbc.queryForObject("select question_type from extracted_questions where id=?",String.class,q)).isEqualTo("MULTIPLE_CHOICE");
  assertThat(mvc.perform(get("/api/teacher/content-pipeline/sources/"+source+"/quality").with(authentication(auth(teacher)))).andReturn().getResponse().getContentAsString()).contains("questionConfidence").contains("mathQuestions");
  long math=jdbc.queryForObject("select id from math_fragments where question_id=? order by id limit 1",Long.class,q);
  assertThat(mvc.perform(put("/api/teacher/content-pipeline/math-fragments/"+math+"/review").contentType(MediaType.APPLICATION_JSON).content("{\"latex\":\"x^2-5x+6=0\",\"decision\":\"EDITED\"}").with(authentication(auth(teacher)))).andReturn().getResponse().getStatus()).isEqualTo(200);
  assertThat(jdbc.queryForObject("select review_decision from math_fragments where id=?",String.class,math)).isEqualTo("EDITED");
  assertThat(mvc.perform(get("/api/teacher/content-pipeline/sources/"+source+"/questions").with(authentication(auth(other)))).andReturn().getResponse().getStatus()).isEqualTo(404);
  String review="{\"questionText\":\"Solve x^2 - 5x + 6 = 0\",\"optionA\":\"1,6\",\"optionB\":\"2,3\",\"optionC\":\"0,5\",\"optionD\":\"-2,-3\",\"answerText\":\"B\",\"solutionText\":\"(x-2)(x-3)\",\"status\":\"REVIEWED\"}";
  assertThat(mvc.perform(put("/api/teacher/content-pipeline/questions/"+q+"/review").contentType(MediaType.APPLICATION_JSON).content(review).with(authentication(auth(teacher)))).andReturn().getResponse().getStatus()).isEqualTo(200);
  assertThat(jdbc.queryForObject("select math_signature from extracted_questions where id=?",String.class,q)).isEqualTo("QUADRATIC_EQUATION");
  assertThat(jdbc.queryForObject("select question_intent from extracted_questions where id=?",String.class,q)).isEqualTo("SOLVE_EQUATION");
  assertThat(jdbc.queryForObject("select transformable from extracted_questions where id=?",Boolean.class,q)).isTrue();
  assertThat(mvc.perform(post("/api/teacher/content-pipeline/questions/"+q+"/variants").contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"PARAMETER_CHANGE\",\"r1\":2,\"r2\":5}").with(authentication(auth(teacher)))).andReturn().getResponse().getStatus()).isEqualTo(200);
  assertThat(jdbc.queryForObject("select validation_status from question_variants where source_question_id=?",String.class,q)).isEqualTo("VALID");
  assertThat(mvc.perform(post("/api/teacher/content-pipeline/worksheets").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Phieu test\",\"items\":[{\"questionId\":"+q+"}]}").with(authentication(auth(teacher)))).andReturn().getResponse().getStatus()).isEqualTo(200);
  assertThat(jdbc.queryForObject("select count(*) from worksheet_items wi join worksheets w on w.id=wi.worksheet_id where w.created_by=? and wi.content_snapshot is not null",Integer.class,teacher)).isEqualTo(1);
 }
 private long user(String prefix){return jdbc.queryForObject("insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at) values(?,'x',?,?, 'TEACHER','ACTIVE',now(),now()) returning id",Long.class,prefix+System.nanoTime()+"@test.local",prefix,prefix+System.nanoTime());}
 private UsernamePasswordAuthenticationToken auth(long id){return new UsernamePasswordAuthenticationToken(new Math10Principal(id,"teacher@test.local","TEACHER"),null,List.of(new SimpleGrantedAuthority("ROLE_TEACHER")));}
}
