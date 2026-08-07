package com.math10.student.dto;
import java.time.LocalDateTime;
import java.util.List;
public record StudentCourseResponse(Long id,String code,String name,String description,String status,List<Chapter> chapters){
 public record Chapter(Long id,String title,Integer orderIndex,List<Lesson> lessons){}
 public record Lesson(Long id,String title,String summary,String contentHtml,Integer orderIndex,String status,String progressStatus,LocalDateTime openedAt,LocalDateTime completedAt,Integer completionPercent,Boolean locked,List<Resource> resources,List<AttachedWorksheet> worksheets){}
 public record Resource(Long id,String type,String title,String externalUrl,Long fileAssetId,String textContent,Integer orderIndex){}
 public record AttachedWorksheet(Long id,String name){}
}
