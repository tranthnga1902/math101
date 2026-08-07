package com.math10.subjects.controller;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.subjects.dto.*;
import com.math10.subjects.entity.Subject;
import com.math10.subjects.repository.SubjectRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequiredArgsConstructor @RequestMapping("/api/subjects")
public class SubjectController {
 private final SubjectRepository repository;
 @GetMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
 public ApiResponse<List<SubjectResponse>> all(){return ApiResponse.ok("Danh sách môn học",repository.findAll().stream().map(this::map).toList());}
 @PostMapping @PreAuthorize("hasRole('ADMIN')") @Transactional
 public ApiResponse<SubjectResponse> create(@Valid @RequestBody SubjectRequest r){if(repository.existsByCode(r.code()))throw new BusinessException("Mã môn học đã tồn tại");Subject s=new Subject();apply(s,r);return ApiResponse.created("Tạo môn học thành công",map(repository.save(s)));}
 @PutMapping("/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
 public ApiResponse<SubjectResponse> update(@PathVariable Long id,@Valid @RequestBody SubjectRequest r){Subject s=find(id);if(repository.existsByCodeAndIdNot(r.code(),id))throw new BusinessException("Mã môn học đã tồn tại");apply(s,r);return ApiResponse.ok("Cập nhật môn học thành công",map(s));}
 @DeleteMapping("/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
 public ApiResponse<Void> delete(@PathVariable Long id){find(id).markDeleted();return ApiResponse.noContent("Xóa môn học thành công");}
 private Subject find(Long id){return repository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy môn học"));}
 private void apply(Subject s,SubjectRequest r){s.setCode(r.code().trim().toUpperCase());s.setName(r.name().trim());}
 private SubjectResponse map(Subject s){return new SubjectResponse(s.getId(),s.getCode(),s.getName());}
}
