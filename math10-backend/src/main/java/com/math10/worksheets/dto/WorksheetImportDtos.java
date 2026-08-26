package com.math10.worksheets.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public final class WorksheetImportDtos {
    private WorksheetImportDtos() {}
    public enum AnswerKeySource { BOLD_UNDERLINE, ANSWER_TABLE, INLINE_MARKER, NONE }
    public enum Severity { ERROR, WARNING }
    public record Issue(Severity severity, String message) {}
    public record Question(Integer questionNo, String statement, String optionA, String optionB,
                           String optionC, String optionD, String correctOption,
                           AnswerKeySource answerSource, double confidence, List<Issue> issues) {}
    public record Preview(String fileName, int totalQuestions, int errorCount, int warningCount,
                          List<Question> questions) {}
    public record PublishQuestion(@NotBlank String statement, @NotBlank String optionA,
                                  @NotBlank String optionB, @NotBlank String optionC,
                                  @NotBlank String optionD, @NotBlank String correctOption) {}
    public record PublishRequest(@NotBlank String name, @NotNull Long problemTypeId,
                                 @NotEmpty List<@Valid PublishQuestion> questions) {}
}
