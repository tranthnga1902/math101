package com.math10.grades.dto;
import jakarta.validation.constraints.*;
public record GradeRequest(@NotBlank @Size(max=50) String code,@NotNull @Min(1) @Max(12) Integer gradeNumber,@NotBlank @Size(max=120) String name){}
