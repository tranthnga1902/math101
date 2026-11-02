package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.programs.ProgramCourseImportService;
import com.math10.programs.dto.ProgramCourseImportDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/program-courses")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ProgramCourseImportController {
    private final ProgramCourseImportService service;

    @GetMapping("/import/template")
    public ResponseEntity<byte[]> template(){return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=program-course-import.xlsx").contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).body(service.template());}

    @PostMapping(value="/import/parse", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ParseResult> parse(@RequestPart(value="file", required=false) MultipartFile file,
                                          @RequestParam(value="pasted", required=false) String pasted){
        return ApiResponse.ok("Đã phân tích cấu trúc cột", service.parse(file, pasted));
    }

    @PostMapping(value="/import/preview",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Preview> preview(@RequestPart("file") MultipartFile file,
                                        @RequestParam(required=false) Long sourceCourseId){
        return ApiResponse.ok("Đã kiểm tra file PPCT",service.preview(file,sourceCourseId));
    }
    @PostMapping("/import/confirm")
    public ApiResponse<ConfirmResult> confirm(@RequestBody ConfirmRequest request){return ApiResponse.ok("Đã nhập chương trình",service.confirm(request.previewToken()));}

    @GetMapping("/{courseId}/tree")
    public ApiResponse<Derived> tree(@PathVariable long courseId){return ApiResponse.ok("Cây chương trình",service.tree(courseId));}
}
