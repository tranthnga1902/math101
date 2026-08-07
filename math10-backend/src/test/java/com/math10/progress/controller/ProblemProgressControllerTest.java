package com.math10.progress.controller;

import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.mathcontent.entity.Problem;
import com.math10.mathcontent.repository.ProblemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProblemProgressControllerTest {
    @Test
    void completesPublishedPracticeForCurrentStudent() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CurrentUserService current = mock(CurrentUserService.class);
        ProblemRepository problems = mock(ProblemRepository.class);
        Problem problem = new Problem();
        problem.setProblemKind("PRACTICE");
        problem.setStatus("PUBLISHED");
        when(problems.findById(8L)).thenReturn(Optional.of(problem));
        when(current.requireUserId()).thenReturn(3L);
        when(jdbc.queryForMap(anyString(), eq(3L), eq(8L))).thenReturn(Map.of("problem_id", 8L, "status", "COMPLETED"));

        var result = new ProblemProgressController(jdbc, current, problems).completed(8L).data();

        assertThat(result.get("status")).isEqualTo("COMPLETED");
        verify(jdbc).update(anyString(), eq(3L), eq(8L), any(), any(), any(), any());
    }

    @Test
    void rejectsExamProgress() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CurrentUserService current = mock(CurrentUserService.class);
        ProblemRepository problems = mock(ProblemRepository.class);
        Problem exam = new Problem();
        exam.setProblemKind("EXAM");
        exam.setStatus("PUBLISHED");
        when(problems.findById(8L)).thenReturn(Optional.of(exam));

        assertThatThrownBy(() -> new ProblemProgressController(jdbc, current, problems).opened(8L))
                .isInstanceOf(BusinessException.class);
        verifyNoInteractions(jdbc);
    }
}
