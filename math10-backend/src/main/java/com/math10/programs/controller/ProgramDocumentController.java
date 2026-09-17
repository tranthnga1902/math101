package com.math10.programs.controller;

import com.math10.configuration.security.CurrentUserService;
import com.math10.documents.service.DocumentService;
import com.math10.documents.support.DocumentUrls;
import com.math10.programs.support.LuongNoiDung;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import com.math10.common.dto.ApiResponse;
import java.util.Map;

/** Legacy documents without file_assets still need the distribution's access checks. */
@RestController
@RequiredArgsConstructor
public class ProgramDocumentController {
    private final JdbcTemplate jdbc;
    private final CurrentUserService current;
    private final LuongNoiDung rules;
    private final DocumentService documents;

    @GetMapping("/api/program-resources/{id}/content.{ext}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ResponseEntity<byte[]> content(@PathVariable Long id, @PathVariable String ext) {
        var row=readableDocument(id);
        String extension=DocumentUrls.extensionOf((String)row.get("file_url"));
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType("document."+extension).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(documents.readDocumentBytes(((Number)row.get("id")).longValue()));
    }

    @GetMapping("/api/program-resources/{id}/preview.pdf")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ResponseEntity<byte[]> preview(@PathVariable Long id) {
        long documentId=((Number)readableDocument(id).get("id")).longValue();
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).body(documents.readDocumentPreviewPdf(documentId));
    }

    @PostMapping("/api/program-resources/{id}/package/launch")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<Map<String,String>> launch(@PathVariable Long id) {
        long documentId=((Number)readableDocument(id).get("id")).longValue();
        return ApiResponse.ok("Mở gói học liệu",Map.of("launchUrl",documents.launchDocumentPackage(documentId)));
    }

    private Map<String,Object> readableDocument(Long id) {
        if ("STUDENT".equals(current.requireRoleCode()) && !rules.moDuocMuc(id,current.requireUserId())) {
            throw new AccessDeniedException("Bạn không có quyền mở tài liệu trong chương trình này");
        }
        var rows=jdbc.queryForList("""
                select d.id,d.file_url from program_resources pr
                join documents d on d.id=pr.resource_ref_id and d.deleted_at is null
                where pr.id=? and pr.resource_type='DOCUMENT' and pr.deleted_at is null
                """,id);
        if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy tài liệu trong chương trình");
        return rows.get(0);
    }
}
