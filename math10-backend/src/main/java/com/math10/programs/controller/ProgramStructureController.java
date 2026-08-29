package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.entity.PublishStatus;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.courses.entity.Course;
import com.math10.courses.entity.CourseStatus;
import com.math10.courses.repository.CourseRepository;
import com.math10.configuration.security.CurrentUserService;
import com.math10.lessons.repository.LessonRepository;
import com.math10.programs.entity.ExerciseType;
import com.math10.programs.repository.ExerciseTypeRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController @RequiredArgsConstructor
public class ProgramStructureController {
    private final CourseRepository programs;
    private final LessonRepository lessons;
    private final ExerciseTypeRepository exerciseTypes;
    private final CurrentUserService current;

    @GetMapping("/api/programs") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ProgramView>> publishedPrograms() {
        return ApiResponse.ok("Chương trình đã xuất bản", programs.findAll(Sort.by("name")).stream()
                .filter(p -> p.getStatus() == CourseStatus.PUBLISHED).map(ProgramView::of).toList());
    }

    @GetMapping("/api/programs/{id}") @PreAuthorize("isAuthenticated()")
    public ApiResponse<ProgramView> publishedProgram(@PathVariable Long id) {
        Course row=program(id); if(row.getStatus()!=CourseStatus.PUBLISHED) throw new ResourceNotFoundException("Không tìm thấy chương trình");
        return ApiResponse.ok("Chương trình", ProgramView.of(row));
    }

    @GetMapping("/api/admin/programs") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<ProgramView>> adminPrograms() { return ApiResponse.ok("Tất cả chương trình", programs.findAll(Sort.by("name")).stream().map(ProgramView::of).toList()); }

    @PostMapping("/api/admin/programs") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<ProgramView> create(@Valid @RequestBody ProgramRequest request) { Course row=new Course(); apply(row,request); return ApiResponse.created("Đã tạo chương trình",ProgramView.of(programs.save(row))); }

    @GetMapping("/api/admin/programs/{id}") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ProgramView> adminProgram(@PathVariable Long id) { return ApiResponse.ok("Chương trình",ProgramView.of(program(id))); }

    @PutMapping("/api/admin/programs/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<ProgramView> update(@PathVariable Long id,@Valid @RequestBody ProgramRequest request) { Course row=program(id);apply(row,request);return ApiResponse.ok("Đã cập nhật chương trình",ProgramView.of(row)); }

    @PostMapping("/api/admin/programs/{id}/publish") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<ProgramView> publish(@PathVariable Long id) { Course row=program(id);row.setStatus(CourseStatus.PUBLISHED);row.setPublishedBy(current.requireUserId());row.setPublishedAt(LocalDateTime.now());return ApiResponse.ok("Đã xuất bản chương trình",ProgramView.of(row)); }

    @GetMapping("/api/lessons/{lessonId}/exercise-types") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ExerciseTypeView>> exerciseTypes(@PathVariable Long lessonId) { lessons.findById(lessonId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));return ApiResponse.ok("Dạng bài",exerciseTypes.findByLessonIdOrderByOrderIndexAsc(lessonId).stream().filter(x->x.getStatus()==PublishStatus.PUBLISHED).map(ExerciseTypeView::of).toList()); }

    @PostMapping("/api/admin/lessons/{lessonId}/exercise-types") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<ExerciseTypeView> createExerciseType(@PathVariable Long lessonId,@Valid @RequestBody ExerciseTypeRequest request) { lessons.findById(lessonId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));ExerciseType row=new ExerciseType();row.setLessonId(lessonId);apply(row,request);return ApiResponse.created("Đã tạo dạng bài",ExerciseTypeView.of(exerciseTypes.save(row))); }

    @PutMapping("/api/admin/exercise-types/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<ExerciseTypeView> updateExerciseType(@PathVariable Long id,@Valid @RequestBody ExerciseTypeRequest request) { ExerciseType row=exerciseTypes.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy dạng bài"));apply(row,request);return ApiResponse.ok("Đã cập nhật dạng bài",ExerciseTypeView.of(row)); }

    @DeleteMapping("/api/admin/exercise-types/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> deleteExerciseType(@PathVariable Long id) { ExerciseType row=exerciseTypes.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy dạng bài"));exerciseTypes.delete(row);return ApiResponse.ok("Đã xoá dạng bài",null); }

    private Course program(Long id){return programs.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương trình"));}
    private void apply(Course row,ProgramRequest x){row.setCode(x.code());row.setName(x.name());row.setDescription(x.description());row.setStatus(x.status()==null?CourseStatus.DRAFT:x.status());}
    private void apply(ExerciseType row,ExerciseTypeRequest x){row.setName(x.name());row.setDescription(x.description());row.setOrderIndex(x.orderIndex());row.setStatus(x.status()==null?PublishStatus.DRAFT:x.status());}

    public record ProgramRequest(@NotBlank String code,@NotBlank String name,String description,CourseStatus status){}
    public record ProgramView(Long id,String code,String name,String description,CourseStatus status,LocalDateTime publishedAt){static ProgramView of(Course x){return new ProgramView(x.getId(),x.getCode(),x.getName(),x.getDescription(),x.getStatus(),x.getPublishedAt());}}
    public record ExerciseTypeRequest(@NotBlank String name,String description,@NotNull Integer orderIndex,PublishStatus status){}
    public record ExerciseTypeView(Long id,Long lessonId,String name,String description,Integer orderIndex,PublishStatus status){static ExerciseTypeView of(ExerciseType x){return new ExerciseTypeView(x.getId(),x.getLessonId(),x.getName(),x.getDescription(),x.getOrderIndex(),x.getStatus());}}
}
