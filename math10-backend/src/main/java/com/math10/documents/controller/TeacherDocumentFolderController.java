package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentFolder;
import com.math10.documents.repository.DocumentFolderRepository;
import com.math10.documents.repository.DocumentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teacher/document-folders")
@PreAuthorize("hasRole('TEACHER')")
public class TeacherDocumentFolderController {
    private final DocumentFolderRepository folders;
    private final DocumentRepository documents;
    private final CurrentUserService current;

    @GetMapping
    public ApiResponse<List<FolderResponse>> list(){Long owner=current.requireUserId();return ApiResponse.ok("Danh sách thư mục",folders.findByOwnerIdOrderByNameAsc(owner).stream().map(folder->map(folder,documents.findByFolderId(folder.getId()).size())).toList());}

    @PostMapping @Transactional
    public ApiResponse<FolderResponse> create(@Valid @RequestBody FolderRequest request){Long owner=current.requireUserId();String name=request.name().trim();if(folders.existsByOwnerIdAndNameIgnoreCaseAndIdNot(owner,name,-1L))throw new BusinessException("Tên thư mục đã tồn tại");DocumentFolder folder=new DocumentFolder();folder.setOwnerId(owner);folder.setName(name);try{return ApiResponse.created("Tạo thư mục thành công",map(folders.save(folder),0));}catch(DataIntegrityViolationException exception){throw new BusinessException("Tên thư mục đã tồn tại");}}

    @PutMapping("/{id}") @Transactional
    public ApiResponse<FolderResponse> rename(@PathVariable Long id,@Valid @RequestBody FolderRequest request){DocumentFolder folder=ownedFolder(id);String name=request.name().trim();if(folders.existsByOwnerIdAndNameIgnoreCaseAndIdNot(folder.getOwnerId(),name,id))throw new BusinessException("Tên thư mục đã tồn tại");folder.setName(name);return ApiResponse.ok("Đổi tên thư mục thành công",map(folders.save(folder),documents.findByFolderId(id).size()));}

    @DeleteMapping("/{id}") @Transactional
    public ApiResponse<Void> delete(@PathVariable Long id){DocumentFolder folder=ownedFolder(id);documents.findByFolderId(id).forEach(document->{document.setFolderId(null);documents.save(document);});folder.markDeleted();folders.save(folder);return ApiResponse.noContent("Đã xóa thư mục; tài liệu được chuyển về Chưa phân loại");}

    @PatchMapping("/documents/{documentId}") @Transactional
    public ApiResponse<Void> move(@PathVariable Long documentId,@RequestBody MoveRequest request){Document document=ownedDocument(documentId);if(request.folderId()!=null)ownedFolder(request.folderId());document.setFolderId(request.folderId());documents.save(document);return ApiResponse.noContent("Đã di chuyển tài liệu");}

    private DocumentFolder ownedFolder(Long id){DocumentFolder folder=folders.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy thư mục"));if(!current.requireUserId().equals(folder.getOwnerId()))throw new AccessDeniedException("Không có quyền truy cập thư mục");return folder;}
    private Document ownedDocument(Long id){Document document=documents.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy tài liệu"));if(!current.requireUserId().equals(document.getOwnerId()))throw new AccessDeniedException("Không có quyền thay đổi tài liệu");return document;}
    private FolderResponse map(DocumentFolder folder,int count){return new FolderResponse(folder.getId(),folder.getName(),count,folder.getCreatedAt());}
    public record FolderRequest(@NotBlank @Size(max=120) String name){}
    public record MoveRequest(Long folderId){}
    public record FolderResponse(Long id,String name,Integer documentCount,java.time.LocalDateTime createdAt){}
}
