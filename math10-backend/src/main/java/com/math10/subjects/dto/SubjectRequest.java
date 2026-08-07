package com.math10.subjects.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record SubjectRequest(@NotBlank @Size(max=50) String code, @NotBlank @Size(max=120) String name) {}
