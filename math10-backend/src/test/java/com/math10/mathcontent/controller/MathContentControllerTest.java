package com.math10.mathcontent.controller;
import com.math10.configuration.security.CurrentUserService;
import com.math10.mathcontent.dto.MathContentDtos.ProblemRequest;
import com.math10.mathcontent.entity.*;
import com.math10.mathcontent.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.math10.audit.service.AuditService;
import com.math10.common.exception.BusinessException;
@ExtendWith(MockitoExtension.class)
class MathContentControllerTest {
 @Mock TopicRepository topics;@Mock ProblemTypeRepository types;@Mock ProblemRepository problems;@Mock ProblemHintRepository hints;@Mock SolutionStepRepository solutions;@Mock CurrentUserService current;@Mock AuditService audit;
 MathContentController controller;ProblemType type;
 @BeforeEach void setup(){controller=new MathContentController(topics,types,problems,hints,solutions,current,audit);type=new ProblemType();type.setId(2L);when(types.findById(2L)).thenReturn(Optional.of(type));}
 @Test void createsStableEightCharacterQrSlug(){
  when(current.requireUserId()).thenReturn(7L);when(problems.existsByPublicCode("M10-01")).thenReturn(false);when(problems.existsByQrSlug(anyString())).thenReturn(false);
  when(problems.save(any())).thenAnswer(x->{Problem p=x.getArgument(0);p.setId(9L);return p;});
  var created=controller.createProblem(new ProblemRequest(2L,"M10-01","x^2=4",null,"REINFORCEMENT","PUBLISHED","PRACTICE",null,null,null,null)).data();
  assertThat(created.qrSlug()).hasSize(8);assertThat(created.publicCode()).isEqualTo("M10-01");
  Problem entity=new Problem();entity.setId(9L);entity.setCreatedBy(7L);entity.setProblemTypeId(2L);entity.setPublicCode(created.publicCode());entity.setQrSlug(created.qrSlug());entity.setStatementLatex("x^2=4");entity.setContentHtml("x^2=4");entity.setDifficulty("REINFORCEMENT");entity.setStatus("PUBLISHED");entity.setProblemKind("PRACTICE");
  when(problems.findById(9L)).thenReturn(Optional.of(entity));
  var updated=controller.updateProblem(9L,new ProblemRequest(2L,"IGNORED","x^2=9",null,"ADVANCED","PUBLISHED","PRACTICE",null,null,null,null)).data();
  assertThat(updated.qrSlug()).isEqualTo(created.qrSlug());assertThat(updated.publicCode()).isEqualTo("M10-01");
 }
 @Test void examHasNoQrAndCannotReceiveHints(){
  when(current.requireUserId()).thenReturn(7L);when(problems.existsByPublicCode("EX-01")).thenReturn(false);
  when(problems.save(any())).thenAnswer(x->{Problem p=x.getArgument(0);p.setId(10L);return p;});
  var created=controller.createProblem(new ProblemRequest(2L,"EX-01","x=1",null,"ADVANCED","DRAFT","EXAM",null,null,null,null)).data();
  assertThat(created.qrSlug()).isNull();
  Problem exam=new Problem();exam.setId(10L);exam.setCreatedBy(7L);exam.setProblemKind("EXAM");
  when(problems.findById(10L)).thenReturn(Optional.of(exam));
  org.assertj.core.api.Assertions.assertThatThrownBy(()->controller.createHint(new com.math10.mathcontent.dto.MathContentDtos.HintRequest(10L,"hint",1)))
    .isInstanceOf(BusinessException.class);
 }
}
