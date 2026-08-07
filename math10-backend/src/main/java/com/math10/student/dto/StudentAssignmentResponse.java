package com.math10.student.dto;
import java.time.LocalDateTime;
import java.util.List;
public record StudentAssignmentResponse(Long id,String title,LocalDateTime dueAt,String status,Long lessonId,Long worksheetId,String worksheetName,String progressStatus,Integer completionPercent,List<Item> items){
 public record Item(Long problemId,Integer orderIndex,String publicCode,String qrSlug,String statementLatex,String difficulty){}
}
