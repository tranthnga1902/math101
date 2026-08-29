package com.math10.teachercontent;

import com.math10.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;

@Service @RequiredArgsConstructor
public class TeacherContentPipelineService {
 private final JdbcTemplate jdbc;
 private final QuestionMathAnalysisService analysis;
 private static final Pattern START=Pattern.compile("^(?:C\\p{L}*|B\\p{L}*|Question)\\s*(\\d{1,3})[.:)]\\s*(.*)$",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
 private static final Pattern OPTION=Pattern.compile("^([A-D])[.)]\\s*(.*)$",Pattern.CASE_INSENSITIVE);
 private static final Pattern MATH=Pattern.compile("(?:[a-zA-Z]\\s*=\\s*)?[-+]?\\d*[a-zA-Z](?:\\^?[²³\\d]|[-+*/=()\\s\\d.a-zA-Z]){2,}|\\\\sqrt\\{[^}]+}|√\\([^)]*\\)");

 public ParseResult parse(long sourceId,MultipartFile file,String type){
  try{
   Extracted e=switch(type){case "PDF"->pdf(file.getBytes());case "DOCX"->new Extracted(docx(file.getInputStream()),1,"DOCX");default->new Extracted(new String(file.getBytes(),StandardCharsets.UTF_8),1,type);};
   if(e.text().isBlank()){
    jdbc.update("update teacher_source_documents set status='UNSUPPORTED_SCAN',pipeline_stage='UNSUPPORTED',parser_type='PDF_IMAGE_ONLY',page_count=?,failure_reason=?,quality_label='KEM',updated_at=now() where id=?",e.pages(),"PDF dạng scan chưa được hỗ trợ trong phiên bản hiện tại",sourceId);
    return new ParseResult(0,0,e.pages(),"UNSUPPORTED_SCAN");
   }
   return persist(sourceId,e);
  }catch(Exception ex){jdbc.update("update teacher_source_documents set status='FAILED',pipeline_stage='FAILED',failure_reason=?,updated_at=now() where id=?",safe(ex.getMessage()),sourceId);throw new BusinessException("Không thể phân tích tài liệu: "+safe(ex.getMessage()));}
 }
 private Extracted pdf(byte[] bytes)throws IOException{try(PDDocument d=Loader.loadPDF(bytes)){return new Extracted(new PDFTextStripper().getText(d),d.getNumberOfPages(),"PDF_TEXT");}}
 private String docx(InputStream in)throws IOException{try(XWPFDocument d=new XWPFDocument(in)){StringBuilder b=new StringBuilder();d.getParagraphs().forEach(p->b.append(p.getText()).append('\n'));d.getTables().forEach(t->t.getRows().forEach(r->r.getTableCells().forEach(c->b.append(c.getText()).append('\n'))));return b.toString();}}
 private ParseResult persist(long sourceId,Extracted e){
  List<String> lines=Arrays.stream(e.text().split("\\R")).map(String::trim).filter(x->!x.isBlank()).toList();
  List<Long> ids=new ArrayList<>();
  for(int i=0;i<lines.size();i++){String line=lines.get(i);String kind=START.matcher(line).matches()?"QUESTION":mathFragments(line).isEmpty()?"PARAGRAPH":"FORMULA";ids.add(jdbc.queryForObject("insert into document_blocks(source_document_id,block_type,raw_content,normalized_content,order_index,page_number,created_at,updated_at) values(?,?,?,?,?,?,now(),now()) returning id",Long.class,sourceId,kind,line,normalizeLatex(line),i+1,estimatePage(i,lines.size(),e.pages())));}
  int questions=segment(sourceId,lines,ids),mathQuestions=count(sourceId,"exists(select 1 from math_fragments m where m.question_id=q.id and m.deleted_at is null)"),answered=count(sourceId,"q.answer_text is not null and trim(q.answer_text)<>''");
  Double avg=jdbc.queryForObject("select coalesce(avg(confidence),0) from extracted_questions where source_document_id=? and deleted_at is null",Double.class,sourceId);
  Double math=jdbc.queryForObject("select coalesce(avg(m.confidence),0) from math_fragments m join extracted_questions q on q.id=m.question_id where q.source_document_id=? and m.deleted_at is null",Double.class,sourceId);
  int warnings=Math.max(0,questions-answered)+count(sourceId,"q.confidence<0.8");double coverage=Math.min(1d,e.text().replaceAll("\\s","").length()/(double)Math.max(1,e.pages()*500));String quality=avg>=.88&&warnings<=Math.max(1,questions/10)?"TOT":avg>=.65?"CAN_KIEM_TRA":"KEM";
  jdbc.update("update teacher_source_documents set status='PARSED',pipeline_stage='REVIEW',parser_type=?,page_count=?,block_count=?,text_coverage=?,question_confidence=?,math_confidence=?,warning_count=?,quality_label=?,math_question_count=?,answered_question_count=?,updated_at=now() where id=?",e.parser(),e.pages(),lines.size(),coverage,avg,math==null?0:math,warnings,quality,mathQuestions,answered,sourceId);
  return new ParseResult(lines.size(),questions,e.pages(),"PARSED");
 }
 private int count(long source,String clause){return jdbc.queryForObject("select count(*) from extracted_questions q where q.source_document_id=? and q.deleted_at is null and "+clause,Integer.class,source);}
 private int segment(long sourceId,List<String> lines,List<Long> blocks){int count=0,start=-1;for(int i=0;i<=lines.size();i++){boolean boundary=i<lines.size()&&START.matcher(lines.get(i)).matches();if(boundary&&start>=0){saveQuestion(sourceId,lines,blocks,start,i-1);count++;}if(boundary)start=i;}if(start>=0){saveQuestion(sourceId,lines,blocks,start,lines.size()-1);count++;}return count;}
 private void saveQuestion(long sourceId,List<String> lines,List<Long> blocks,int start,int end){Matcher sm=START.matcher(lines.get(start));sm.matches();StringBuilder stem=new StringBuilder(sm.group(2));Map<String,String> options=new LinkedHashMap<>();String answer=null,solution=null;for(int i=start+1;i<=end;i++){Matcher om=OPTION.matcher(lines.get(i));String low=lines.get(i).toLowerCase(Locale.ROOT);if(om.matches())options.put(om.group(1).toUpperCase(),om.group(2));else if(low.startsWith("đáp án")||low.startsWith("answer"))answer=afterColon(lines.get(i));else if(low.startsWith("lời giải")||low.startsWith("solution"))solution=afterColon(lines.get(i));else stem.append('\n').append(lines.get(i));}double confidence=options.size()==4?.95:.72;String type=options.size()>=2?"MULTIPLE_CHOICE":answer!=null&&answer.length()<80?"SHORT_ANSWER":"FREE_RESPONSE";Long id=jdbc.queryForObject("insert into extracted_questions(source_document_id,start_block_id,end_block_id,question_text,option_a,option_b,option_c,option_d,answer_text,solution_text,confidence,status,transform_level,question_type,options_json,source_start,source_end,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,'DETECTED',?,?,cast(? as jsonb),?,?,now(),now()) returning id",Long.class,sourceId,blocks.get(start),blocks.get(end),stem.toString(),options.get("A"),options.get("B"),options.get("C"),options.get("D"),answer,solution,confidence,classify(stem.toString()),type,optionsJson(options),start+1,end+1);int order=1;for(String raw:mathFragments(stem.toString())){double mc=raw.contains("=")?.95:.78;jdbc.update("insert into math_fragments(question_id,raw_value,latex_value,ast_json,order_index,status,confidence,review_decision,created_at,updated_at) values(?,?,?,cast(? as jsonb),?,'NORMALIZED',?,'PENDING',now(),now())",id,raw,normalizeLatex(raw),ast(raw),order++,mc);}analysis.analyze(id);}
 private List<String> mathFragments(String text){List<String> out=new ArrayList<>();Matcher m=MATH.matcher(text);while(m.find())out.add(m.group().trim());return out;}
 public String normalizeLatex(String x){return x.replace("²","^2").replace("³","^3").replaceAll("√\\(([^)]*)\\)","\\\\sqrt{$1}").replace("×","\\cdot ").replace("÷","\\div ");}
 public String classify(String q){String x=normalizeLatex(q);return x.matches("(?s).*[a-zA-Z].*=.*")?"LEVEL_2":"LEVEL_0";}
 private String ast(String raw){String safe=normalizeLatex(raw).replace("\\","\\\\").replace("\"","\\\"");return "{\"type\":\"SYMBOLIC_EXPRESSION\",\"source\":\""+safe+"\"}";}
 private String optionsJson(Map<String,String> x){return "{\"A\":"+json(x.get("A"))+",\"B\":"+json(x.get("B"))+",\"C\":"+json(x.get("C"))+",\"D\":"+json(x.get("D"))+"}";}
 private String json(String x){return x==null?"null":"\""+x.replace("\\","\\\\").replace("\"","\\\"")+"\"";}
 private String afterColon(String x){int i=x.indexOf(':');return i<0?x:x.substring(i+1).trim();}
 private int estimatePage(int i,int total,int pages){return Math.min(pages,1+(int)((long)i*pages/Math.max(1,total)));}
 private String safe(String x){return x==null?"Lỗi không xác định":x.substring(0,Math.min(500,x.length()));}
 private record Extracted(String text,int pages,String parser){}
 public record ParseResult(int blocks,int questions,int pages,String status){}
}
