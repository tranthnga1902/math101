package com.math10.teachercontent;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.text.Normalizer;
import java.util.*;

@Service @RequiredArgsConstructor
public class QuestionMathAnalysisService {
 private static final double THRESHOLD=.85;
 private final JdbcTemplate jdbc;

 public Analysis analyze(long questionId){
  Map<String,Object> q=jdbc.queryForMap("select * from extracted_questions where id=? and deleted_at is null",questionId);
  List<Map<String,Object>> fragments=jdbc.queryForList("select * from math_fragments where question_id=? and deleted_at is null order by order_index",questionId);
  String stem=Objects.toString(q.get("question_text"),""), math=fragments.stream().map(x->Objects.toString(x.get("latex_value"),"")).reduce("",(a,b)->a+" "+b).trim();
  Signature signature=signature(math.isBlank()?stem:math);Intent intent=intent(stem);
  boolean structure=structureValid(q),mathValid=!fragments.isEmpty()&&fragments.stream().allMatch(this::fragmentValid);
  boolean compatible=compatible(signature.code(),intent.code());
  boolean transformable=signature.confidence()>=THRESHOLD&&intent.confidence()>=THRESHOLD&&mathValid&&structure&&compatible;
  String reason=transformable?null:reason(signature,intent,mathValid,structure,compatible);
  jdbc.update("update extracted_questions set math_signature=?,signature_confidence=?,question_intent=?,intent_confidence=?,math_parse_valid=?,structure_valid=?,transformable=?,transform_block_reason=?,analysis_version='SIGNATURE_INTENT_V1',transform_level=?,updated_at=now() where id=?",signature.code(),signature.confidence(),intent.code(),intent.confidence(),mathValid,structure,transformable,reason,transformable?"LEVEL_2":"LEVEL_0",questionId);
  return new Analysis(signature.code(),signature.confidence(),intent.code(),intent.confidence(),mathValid,structure,transformable,reason);
 }
 private Signature signature(String input){String x=compact(input);boolean function=x.matches(".*(?:y|f\\(x\\))=.*");boolean equation=x.contains("=");boolean quadratic=x.matches(".*x(?:\\^2|²).*"),linear=x.matches(".*x.*")&&!quadratic;
  if(function&&quadratic)return new Signature("QUADRATIC_FUNCTION",.96);
  if(function&&linear)return new Signature("LINEAR_FUNCTION",.95);
  if(equation&&quadratic)return new Signature("QUADRATIC_EQUATION",.95);
  if(equation&&linear)return new Signature("LINEAR_EQUATION",.95);
  if(quadratic)return new Signature("QUADRATIC_EXPRESSION",.90);
  if(linear)return new Signature("LINEAR_EXPRESSION",.88);
  return new Signature("UNSUPPORTED",.20);
 }
 private Intent intent(String input){String x=plain(input);
  if(has(x,"giai phuong trinh","tim nghiem cua phuong trinh","solve equation","solve "))return new Intent("SOLVE_EQUATION",.97);
  if(has(x,"tim nghiem","giao diem voi ox","find root","zero of"))return new Intent("FIND_ROOT",.92);
  if(has(x,"tinh gia tri","gia tri cua ham","find function value"))return new Intent("FIND_FUNCTION_VALUE",.93);
  if(has(x,"tim dinh","toa do dinh","find vertex"))return new Intent("FIND_VERTEX",.97);
  if(has(x,"truc doi xung","find axis"))return new Intent("FIND_AXIS",.97);
  if(has(x,"he so","coefficient"))return new Intent("IDENTIFY_COEFFICIENT",.90);
  return new Intent("UNKNOWN",.20);
 }
 private boolean fragmentValid(Map<String,Object> f){double confidence=((Number)f.get("confidence")).doubleValue();String decision=Objects.toString(f.get("review_decision"),"PENDING"),latex=Objects.toString(f.get("latex_value"),"");return confidence>=.75&&!latex.isBlank()&&!"KEEP_TEXT".equals(decision)&&(balanced(latex)||"ACCEPTED".equals(decision)||"EDITED".equals(decision));}
 private boolean structureValid(Map<String,Object> q){String type=Objects.toString(q.get("question_type"),"UNKNOWN");if("UNKNOWN".equals(type)||Objects.toString(q.get("question_text"),"").isBlank())return false;if("MCQ".equals(type))return q.get("option_a")!=null&&q.get("option_b")!=null&&q.get("option_c")!=null&&q.get("option_d")!=null;return true;}
 private boolean compatible(String s,String i){return switch(s){case "LINEAR_EQUATION","QUADRATIC_EQUATION"->Set.of("SOLVE_EQUATION","FIND_ROOT","IDENTIFY_COEFFICIENT").contains(i);case "LINEAR_FUNCTION"->Set.of("FIND_ROOT","FIND_FUNCTION_VALUE","IDENTIFY_COEFFICIENT").contains(i);case "QUADRATIC_FUNCTION"->Set.of("FIND_ROOT","FIND_FUNCTION_VALUE","FIND_VERTEX","FIND_AXIS","IDENTIFY_COEFFICIENT").contains(i);case "LINEAR_EXPRESSION","QUADRATIC_EXPRESSION"->"IDENTIFY_COEFFICIENT".equals(i);default->false;};}
 private String reason(Signature s,Intent i,boolean math,boolean structure,boolean compatible){if("UNSUPPORTED".equals(s.code()))return "Dạng toán chưa được hỗ trợ";if(s.confidence()<THRESHOLD)return "Độ tin cậy dạng toán chưa đạt ngưỡng";if("UNKNOWN".equals(i.code()))return "Chưa nhận diện được yêu cầu của câu hỏi";if(i.confidence()<THRESHOLD)return "Độ tin cậy ý định chưa đạt ngưỡng";if(!math)return "Công thức chưa hợp lệ hoặc chưa được chuẩn hóa";if(!structure)return "Cấu trúc câu hỏi chưa đầy đủ";if(!compatible)return "Dạng toán và yêu cầu câu hỏi chưa có rule an toàn";return "Không hỗ trợ biến đổi tự động";}
 private boolean balanced(String x){int n=0;for(char c:x.toCharArray()){if(c=='{'||c=='(')n++;if(c=='}'||c==')')n--;if(n<0)return false;}return n==0;}
 private String compact(String x){return x.toLowerCase(Locale.ROOT).replace("\\left","").replace("\\right","").replaceAll("\\s+","");}
 private String plain(String x){return Normalizer.normalize(x.toLowerCase(Locale.ROOT),Normalizer.Form.NFD).replaceAll("\\p{M}","").replace('đ','d');}
 private boolean has(String x,String... values){return Arrays.stream(values).anyMatch(x::contains);}
 private record Signature(String code,double confidence){} private record Intent(String code,double confidence){}
 public record Analysis(String signature,double signatureConfidence,String intent,double intentConfidence,boolean mathParseValid,boolean structureValid,boolean transformable,String reason){}
}
