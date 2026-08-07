package com.math10.grades.controller;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.*;
import com.math10.grades.dto.*;
import com.math10.grades.entity.Grade;
import com.math10.grades.repository.GradeRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequiredArgsConstructor @RequestMapping("/api/grades")
public class GradeController {
 private final GradeRepository repository;
 @GetMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
 public ApiResponse<List<GradeResponse>> all(){return ApiResponse.ok("Danh sách khối lớp",repository.findAll().stream().map(this::map).toList());}
 @PostMapping @PreAuthorize("hasRole('ADMIN')") @Transactional
 public ApiResponse<GradeResponse> create(@Valid @RequestBody GradeRequest r){if(repository.existsByCode(r.code()))throw new BusinessException("Mã khối đã tồn tại");Grade g=new Grade();apply(g,r);return ApiResponse.created("Tạo khối thành công",map(repository.save(g)));}
 @PutMapping("/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
 public ApiResponse<GradeResponse> update(@PathVariable Long id,@Valid @RequestBody GradeRequest r){Grade g=find(id);if(repository.existsByCodeAndIdNot(r.code(),id))throw new BusinessException("Mã khối đã tồn tại");apply(g,r);return ApiResponse.ok("Cập nhật khối thành công",map(g));}
 @DeleteMapping("/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
 public ApiResponse<Void> delete(@PathVariable Long id){find(id).markDeleted();return ApiResponse.noContent("Xóa khối thành công");}
 private Grade find(Long id){return repository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy khối"));}
 private void apply(Grade g,GradeRequest r){g.setCode(r.code().trim().toUpperCase());g.setGradeNumber(r.gradeNumber());g.setName(r.name().trim());}
 private GradeResponse map(Grade g){return new GradeResponse(g.getId(),g.getCode(),g.getGradeNumber(),g.getName());}
}
