package com.math10.documents.service;

import com.math10.audit.service.AuditService;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentFolder;
import com.math10.documents.repository.DocumentFolderRepository;
import com.math10.documents.repository.DocumentRepository;
import com.math10.documents.support.FolderTree;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Cây thư mục của thư viện dùng chung (owner_id null). Thư mục chỉ là chỗ xếp — không đổi quyền
 * đọc: ai đọc được tài liệu vẫn do audience/status quyết định, di chuyển thư mục không mở hay khóa gì.
 */
@Service
@RequiredArgsConstructor
public class AdminDocumentFolderService {

    private final DocumentFolderRepository folders;
    private final DocumentRepository documents;
    private final AuditService audit;

    public record FolderView(Long id, String name, Long parentId, long documentCount, LocalDateTime createdAt) {
    }

    @Transactional(readOnly = true)
    public List<FolderView> list() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : documents.countSharedGroupedByFolder()) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return folders.findByOwnerIdIsNullOrderByNameAsc().stream()
                .map(folder -> view(folder, counts.getOrDefault(folder.getId(), 0L)))
                .toList();
    }

    @Transactional
    public FolderView create(String rawName, Long parentId) {
        String name = cleanName(rawName);
        Map<Long, Long> parentOf = parentMap();
        if (parentId != null) {
            sharedFolder(parentId);
            if (FolderTree.depthOf(parentOf, parentId) + 1 > FolderTree.MAX_DEPTH) {
                throw new BusinessException("Thư mục lồng quá sâu (tối đa " + FolderTree.MAX_DEPTH + " cấp)");
            }
        }
        ensureUniqueName(parentId, name, null);
        DocumentFolder folder = new DocumentFolder();
        folder.setParentId(parentId);
        folder.setName(name);
        DocumentFolder saved = folders.save(folder);
        audit.record("CREATE", "DOCUMENT_FOLDER", saved.getId(), null, "name=%s;parentId=%s".formatted(name, parentId));
        return view(saved, 0);
    }

    @Transactional
    public FolderView rename(Long id, String rawName) {
        DocumentFolder folder = sharedFolder(id);
        String name = cleanName(rawName);
        ensureUniqueName(folder.getParentId(), name, id);
        String before = folder.getName();
        folder.setName(name);
        audit.record("RENAME", "DOCUMENT_FOLDER", id, "name=%s".formatted(before), "name=%s".formatted(name));
        return view(folders.save(folder), documents.findByOwnerIdIsNullAndFolderIdIn(List.of(id)).size());
    }

    @Transactional
    public FolderView move(Long id, Long newParentId) {
        DocumentFolder folder = sharedFolder(id);
        if (Objects.equals(folder.getParentId(), newParentId)) {
            return view(folder, documents.findByOwnerIdIsNullAndFolderIdIn(List.of(id)).size());
        }
        Map<Long, Long> parentOf = parentMap();
        if (newParentId != null) {
            sharedFolder(newParentId);
            if (FolderTree.wouldCreateCycle(parentOf, id, newParentId)) {
                throw new BusinessException("Không thể chuyển thư mục vào chính nó hoặc thư mục con của nó");
            }
            int newDepth = FolderTree.depthOf(parentOf, newParentId) + FolderTree.subtreeHeight(parentOf, id);
            if (newDepth > FolderTree.MAX_DEPTH) {
                throw new BusinessException("Thư mục lồng quá sâu (tối đa " + FolderTree.MAX_DEPTH + " cấp)");
            }
        }
        ensureUniqueName(newParentId, folder.getName(), id);
        Long before = folder.getParentId();
        folder.setParentId(newParentId);
        audit.record("MOVE", "DOCUMENT_FOLDER", id, "parentId=%s".formatted(before), "parentId=%s".formatted(newParentId));
        return view(folders.save(folder), documents.findByOwnerIdIsNullAndFolderIdIn(List.of(id)).size());
    }

    /**
     * Xóa thư mục không xóa gì bên trong: thư mục con và tài liệu được đưa lên thư mục cha
     * (hoặc ra gốc). Kiểm trùng tên trước để không dừng giữa chừng.
     */
    @Transactional
    public void delete(Long id) {
        DocumentFolder folder = sharedFolder(id);
        Long parentId = folder.getParentId();
        List<DocumentFolder> children = folders.findByOwnerIdIsNullAndParentId(id);
        for (DocumentFolder child : children) {
            if (nameTaken(parentId, child.getName(), id)) {
                throw new BusinessException("Nơi nhận đã có thư mục tên \"" + child.getName() + "\" — đổi tên hoặc chuyển thư mục con trước khi xóa");
            }
        }
        List<Document> inside = documents.findByOwnerIdIsNullAndFolderIdIn(List.of(id));
        inside.forEach(document -> document.setFolderId(parentId));
        documents.saveAll(inside);
        folder.markDeleted();
        folders.saveAndFlush(folder);
        children.forEach(child -> child.setParentId(parentId));
        folders.saveAll(children);
        audit.record("DELETE", "DOCUMENT_FOLDER", id,
                "name=%s;parentId=%s".formatted(folder.getName(), parentId),
                "documentsMoved=%d;foldersMoved=%d".formatted(inside.size(), children.size()));
    }

    /** Chuyển một hoặc nhiều tài liệu của thư viện dùng chung vào thư mục (null = bỏ khỏi thư mục). */
    @Transactional
    public int moveDocuments(Collection<Long> documentIds, Long folderId) {
        if (documentIds == null || documentIds.isEmpty()) {
            throw new BusinessException("Chưa chọn tài liệu nào");
        }
        if (folderId != null) {
            sharedFolder(folderId);
        }
        List<Document> targets = documents.findAllById(documentIds);
        if (targets.size() != documentIds.stream().distinct().count()) {
            throw new ResourceNotFoundException("Có tài liệu không tồn tại hoặc đã bị xóa");
        }
        for (Document document : targets) {
            if (document.getOwnerId() != null) {
                throw new BusinessException("Chỉ xếp được tài liệu của thư viện dùng chung");
            }
            Long before = document.getFolderId();
            if (!Objects.equals(before, folderId)) {
                document.setFolderId(folderId);
                audit.record("MOVE", "DOCUMENT", document.getId(), "folderId=%s".formatted(before), "folderId=%s".formatted(folderId));
            }
        }
        documents.saveAll(targets);
        return targets.size();
    }

    /** Dùng khi tải lên: kiểm thư mục trước khi ghi file để không để lại tài liệu lạc chỗ. */
    @Transactional(readOnly = true)
    public void requireSharedFolder(Long folderId) {
        if (folderId != null) {
            sharedFolder(folderId);
        }
    }

    private DocumentFolder sharedFolder(Long id) {
        DocumentFolder folder = folders.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thư mục"));
        if (folder.getOwnerId() != null) {
            throw new ResourceNotFoundException("Không tìm thấy thư mục");
        }
        return folder;
    }

    private Map<Long, Long> parentMap() {
        Map<Long, Long> parentOf = new HashMap<>();
        folders.findByOwnerIdIsNullOrderByNameAsc().forEach(folder -> parentOf.put(folder.getId(), folder.getParentId()));
        return parentOf;
    }

    private void ensureUniqueName(Long parentId, String name, Long exceptId) {
        if (nameTaken(parentId, name, exceptId)) {
            throw new BusinessException("Đã có thư mục \"" + name + "\" ở cùng cấp");
        }
    }

    private boolean nameTaken(Long parentId, String name, Long exceptId) {
        String key = name.toLowerCase(Locale.ROOT);
        return folders.findByOwnerIdIsNullAndParentId(parentId).stream()
                .anyMatch(other -> !other.getId().equals(exceptId) && other.getName().toLowerCase(Locale.ROOT).equals(key));
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) {
            throw new BusinessException("Tên thư mục không được để trống");
        }
        if (name.length() > 120) {
            throw new BusinessException("Tên thư mục tối đa 120 ký tự");
        }
        return name;
    }

    private static FolderView view(DocumentFolder folder, long count) {
        return new FolderView(folder.getId(), folder.getName(), folder.getParentId(), count, folder.getCreatedAt());
    }
}
