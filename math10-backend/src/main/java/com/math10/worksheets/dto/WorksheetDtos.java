package com.math10.worksheets.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public final class WorksheetDtos {
 private WorksheetDtos(){}
 public record Request(@NotBlank String name,@NotNull @Min(1) @Max(2) Integer columnsCount,@NotNull Boolean showQr,@NotNull Boolean showStudentFields,@NotEmpty List<@NotNull Long> problemIds){}
 public record Item(Long id,Long problemId,Integer orderIndex,String publicCode,String qrSlug,String statementLatex,String difficulty){}
 public record Response(Long id,String name,Integer columnsCount,Boolean showQr,Boolean showStudentFields,Long createdBy,Long lessonId,List<Item> items){}
}
