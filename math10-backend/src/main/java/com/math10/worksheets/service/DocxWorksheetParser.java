package com.math10.worksheets.service;

import com.math10.common.exception.BusinessException;
import com.math10.worksheets.dto.WorksheetImportDtos.*;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import java.io.InputStream;
import java.util.*;
import java.util.regex.*;

@Service
public class DocxWorksheetParser {
    private static final Pattern STEM=Pattern.compile("^(?:(?:c[âa]u|b[àa]i|question)\\s*)?(\\d{1,3})\\s*[:.)/]\\s*(.+)$",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
    private static final Pattern OPTION=Pattern.compile("^([A-Da-d])\\s*[.)/]\\s*(.+)$");
    private static final Pattern INLINE=Pattern.compile("^(?:đ[áa]p\\s*[áa]n|đ\\.?a|answer)\\s*[:.]?\\s*([A-Da-d])\\s*$",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
    private static final Pattern KEY=Pattern.compile("(\\d{1,3})\\s*[.\\-:]?\\s*([A-D])",Pattern.CASE_INSENSITIVE);

    public Preview parse(String fileName, InputStream input) {
        try (XWPFDocument doc=new XWPFDocument(input)) {
            List<Line> lines=new ArrayList<>();
            for (IBodyElement element:doc.getBodyElements()) {
                if(element instanceof XWPFParagraph paragraph)addParagraph(lines,paragraph);
                else if(element instanceof XWPFTable table)for(XWPFTableRow row:table.getRows())for(XWPFTableCell cell:row.getTableCells())for(XWPFParagraph p:cell.getParagraphs())addParagraph(lines,p);
            }
            return buildPreview(fileName,lines);
        } catch (Exception e) { throw new BusinessException("Không thể đọc file DOCX: "+e.getMessage()); }
    }

    public Preview parsePlainText(String fileName,String text){if(text==null||text.trim().length()<30)throw new BusinessException("PDF không có lớp văn bản. Vui lòng dùng PDF có thể bôi chọn chữ hoặc chuyển sang DOCX");List<Line> lines=Arrays.stream(text.split("\\R")).map(String::trim).filter(x->!x.isBlank()).map(x->new Line(x,false)).toList();Preview preview=buildPreview(fileName,lines);if(preview.totalQuestions()==0)throw new BusinessException("Không nhận diện được câu hỏi trong PDF. Nếu đây là file scan, cần chạy OCR trước");return preview;}
    private Preview buildPreview(String fileName,List<Line> lines){Map<Integer,String> tableKeys=answerTable(lines);long optionCount=lines.stream().filter(x->OPTION.matcher(x.text).matches()).count();long markedCount=lines.stream().filter(x->OPTION.matcher(x.text).matches()&&x.marked).count();boolean formattingSignal=optionCount>0&&(double)markedCount/optionCount<.4;List<Question> questions=group(lines,tableKeys,formattingSignal);int errors=questions.stream().mapToInt(q->(int)q.issues().stream().filter(i->i.severity()==Severity.ERROR).count()).sum();int warnings=questions.stream().mapToInt(q->(int)q.issues().stream().filter(i->i.severity()==Severity.WARNING).count()).sum();return new Preview(fileName,questions.size(),errors,warnings,questions);}

    private void addParagraph(List<Line> lines,XWPFParagraph p){String text=p.getText().trim();if(text.isBlank())return;boolean marked=false;for(XWPFRun r:p.getRuns()){String t=r.text();if(t==null||t.isBlank())continue;if(r.isBold()||r.getUnderline()!=UnderlinePatterns.NONE||"FF0000".equalsIgnoreCase(r.getColor()))marked=true;}lines.add(new Line(text,marked));}
    private Map<Integer,String> answerTable(List<Line> lines){Map<Integer,String> result=new HashMap<>();boolean section=false;for(Line line:lines){String normalized=line.text.toLowerCase(Locale.ROOT);if(normalized.matches(".*đ[áa]p\\s*[áa]n.*")||normalized.contains("answer key"))section=true;if(!section)continue;Matcher m=KEY.matcher(line.text);while(m.find())result.put(Integer.valueOf(m.group(1)),m.group(2).toUpperCase(Locale.ROOT));}return result;}
    private List<Question> group(List<Line> lines,Map<Integer,String> tableKeys,boolean formattingSignal){List<Question> out=new ArrayList<>();Draft d=null;for(Line line:lines){String normalized=line.text.toLowerCase(Locale.ROOT);if(normalized.matches(".*đ[áa]p\\s*[áa]n.*")||normalized.contains("answer key"))break;Matcher stem=STEM.matcher(line.text);Matcher option=OPTION.matcher(line.text);Matcher inline=INLINE.matcher(line.text);if(stem.matches()){if(d!=null)out.add(finish(d,tableKeys,formattingSignal));d=new Draft(Integer.valueOf(stem.group(1)),stem.group(2));continue;}if(d==null)continue;if(option.matches()){String key=option.group(1).toUpperCase(Locale.ROOT);d.options.put(key,option.group(2));if(line.marked)d.marked.add(key);}else if(inline.matches())d.inline=inline.group(1).toUpperCase(Locale.ROOT);else d.statement+="\n"+line.text;}if(d!=null)out.add(finish(d,tableKeys,formattingSignal));return out;}
    private Question finish(Draft d,Map<Integer,String> tableKeys,boolean formattingSignal){List<Issue> issues=new ArrayList<>();String format=formattingSignal&&d.marked.size()==1?d.marked.iterator().next():null;String table=tableKeys.get(d.no);String answer=d.inline!=null?d.inline:table!=null?table:format;AnswerKeySource source=d.inline!=null?AnswerKeySource.INLINE_MARKER:table!=null?AnswerKeySource.ANSWER_TABLE:format!=null?AnswerKeySource.BOLD_UNDERLINE:AnswerKeySource.NONE;if(d.options.size()!=4)issues.add(new Issue(Severity.ERROR,"Câu hỏi không đủ 4 lựa chọn"));Set<String> sources=new HashSet<>();if(d.inline!=null)sources.add(d.inline);if(table!=null)sources.add(table);if(format!=null)sources.add(format);if(sources.size()>1)issues.add(new Issue(Severity.ERROR,"Các nguồn đáp án mâu thuẫn"));if(answer==null)issues.add(new Issue(Severity.ERROR,"Chưa xác định được đáp án đúng"));long dollars=d.statement.chars().filter(c->c=='$').count();if(dollars%2!=0)issues.add(new Issue(Severity.WARNING,"Công thức có số dấu $ không cân bằng"));double confidence=issues.stream().anyMatch(i->i.severity()==Severity.ERROR)?.35:source==AnswerKeySource.INLINE_MARKER||source==AnswerKeySource.ANSWER_TABLE?.95:.8;return new Question(d.no,d.statement,d.options.getOrDefault("A",""),d.options.getOrDefault("B",""),d.options.getOrDefault("C",""),d.options.getOrDefault("D",""),answer,source,confidence,List.copyOf(issues));}
    private record Line(String text,boolean marked){}
    private static final class Draft{final int no;String statement;final Map<String,String> options=new LinkedHashMap<>();final Set<String> marked=new LinkedHashSet<>();String inline;Draft(int no,String statement){this.no=no;this.statement=statement;}}
}
