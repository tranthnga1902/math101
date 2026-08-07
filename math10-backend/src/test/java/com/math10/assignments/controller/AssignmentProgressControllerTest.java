package com.math10.assignments.controller;
import com.math10.assignments.entity.*;
import com.math10.assignments.repository.*;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.math10.progress.repository.LearningProgressRepository;
class AssignmentProgressControllerTest {
 @Test void studentCompletesOwnClassAssignment(){
  AssignmentRepository assignments=mock(AssignmentRepository.class);AssignmentProgressRepository progress=mock(AssignmentProgressRepository.class);ClassStudentRepository classes=mock(ClassStudentRepository.class);CurrentUserService current=mock(CurrentUserService.class);
  Assignment a=new Assignment();a.setId(3L);a.setClassId(4L);when(assignments.findById(3L)).thenReturn(Optional.of(a));when(current.requireUserId()).thenReturn(7L);when(classes.existsByClassIdAndStudentId(4L,7L)).thenReturn(true);when(progress.findByAssignmentIdAndStudentId(3L,7L)).thenReturn(Optional.empty());when(progress.save(any())).thenAnswer(x->x.getArgument(0));
  LearningProgressRepository learning=mock(LearningProgressRepository.class);var result=new AssignmentProgressController(assignments,progress,classes,current,learning).completed(3L).data();
  assertThat(result.status()).isEqualTo("COMPLETED");assertThat(result.completionPercent()).isEqualTo(100);
 }
 @Test void rejectsAssignmentFromAnotherClass(){
  AssignmentRepository assignments=mock(AssignmentRepository.class);AssignmentProgressRepository progress=mock(AssignmentProgressRepository.class);ClassStudentRepository classes=mock(ClassStudentRepository.class);CurrentUserService current=mock(CurrentUserService.class);
  Assignment a=new Assignment();a.setClassId(4L);when(assignments.findById(3L)).thenReturn(Optional.of(a));when(current.requireUserId()).thenReturn(7L);
  LearningProgressRepository learning=mock(LearningProgressRepository.class);assertThatThrownBy(()->new AssignmentProgressController(assignments,progress,classes,current,learning).opened(3L)).isInstanceOf(AccessDeniedException.class);
 }
}
