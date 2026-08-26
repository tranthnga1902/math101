package com.math10.taxonomy.service.impl;

import com.math10.audit.dto.AuditLogResponse;
import com.math10.audit.entity.AuditLog;
import com.math10.audit.repository.AuditLogRepository;
import com.math10.audit.service.AuditService;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.documents.repository.DocumentRepository;
import com.math10.taxonomy.dto.ArchiveResultResponse;
import com.math10.taxonomy.dto.DuplicateSuggestionResponse;
import com.math10.taxonomy.dto.MergeRequest;
import com.math10.taxonomy.dto.TaxonomyAliasRequest;
import com.math10.taxonomy.dto.TaxonomyAliasView;
import com.math10.taxonomy.dto.TaxonomyNodeRequest;
import com.math10.taxonomy.dto.TaxonomyNodeResponse;
import com.math10.taxonomy.entity.TaxonomyAlias;
import com.math10.taxonomy.entity.TaxonomyNode;
import com.math10.taxonomy.entity.TaxonomyStatus;
import com.math10.taxonomy.repository.DuplicatePairProjection;
import com.math10.taxonomy.repository.TaxonomyAliasRepository;
import com.math10.taxonomy.repository.TaxonomyNodeRepository;
import com.math10.taxonomy.service.TaxonomyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaxonomyServiceImpl implements TaxonomyService {

    private static final Set<TaxonomyStatus> INACTIVE = Set.of(TaxonomyStatus.MERGED, TaxonomyStatus.ARCHIVED);
    private static final String TARGET_TYPE = "TAXONOMY_NODE";

    private final TaxonomyNodeRepository nodeRepository;
    private final TaxonomyAliasRepository aliasRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public List<TaxonomyNodeResponse> tree(String subject) {
        String effectiveSubject = subject == null || subject.isBlank() ? "TOAN_10" : subject;
        Map<Long, Integer> documentCounts = documentCountsByNode();
        return nodeRepository.findBySubjectAndStatusNotOrderByDepthAscOrderNoAsc(effectiveSubject, TaxonomyStatus.MERGED)
                .stream().map(node -> toResponse(node, documentCounts.getOrDefault(node.getId(), 0))).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TaxonomyNodeResponse> activeTree(String subject) {
        return tree(subject).stream().filter(node -> node.status() == TaxonomyStatus.ACTIVE).toList();
    }

    @Override
    @Transactional
    public TaxonomyNodeResponse create(Long parentId, TaxonomyNodeRequest request) {
        TaxonomyNode parent = parentId == null ? null : findEntity(parentId);
        int depth = parent == null ? 1 : parent.getDepth() + 1;
        if (depth > 3) {
            throw new BusinessException("Cây phân loại chỉ có tối đa 3 cấp: Chuyên đề, Bài, Dạng");
        }
        TaxonomyNode node = new TaxonomyNode();
        node.setParentId(parentId);
        node.setSubject(parent == null ? "TOAN_10" : parent.getSubject());
        node.setDepth(depth);
        node.setTitle(request.title());
        node.setDescription(request.description());
        node.setSlug(uniqueSlug(parentId, slugify(request.title()), null));
        node.setOrderNo(nextOrderNo(parentId));
        node.setStatus(TaxonomyStatus.ACTIVE);
        TaxonomyNode saved = nodeRepository.save(node);
        auditService.record("CREATE", TARGET_TYPE, saved.getId(), null, saved.getTitle());
        return toResponse(saved);
    }

    @Override
    @Transactional
    public TaxonomyNodeResponse update(Long id, TaxonomyNodeRequest request) {
        TaxonomyNode node = findEntity(id);
        String oldTitle = node.getTitle();
        node.setTitle(request.title());
        node.setDescription(request.description());
        // Mã (slug) đi theo tên. Nếu giữ mã cũ, hai mục anh em có thể mang cùng một tên mà
        // không có gì chặn lại, và mã hiển thị ở tab Thông tin sẽ không còn khớp với tên.
        node.setSlug(uniqueSlug(node.getParentId(), slugify(request.title()), id));
        auditService.record("UPDATE", TARGET_TYPE, id, oldTitle, request.title());
        return toResponse(node);
    }

    @Override
    @Transactional
    public TaxonomyNodeResponse move(Long id, Long newParentId) {
        TaxonomyNode node = findEntity(id);
        Long oldParentId = node.getParentId();
        if (Objects.equals(oldParentId, newParentId)) {
            throw new BusinessException("Mục này đã nằm trong mục cha đó rồi");
        }
        TaxonomyNode newParent = newParentId == null ? null : findEntity(newParentId);
        if (newParent != null) {
            if (newParent.getId().equals(id) || isSelfOrDescendantOf(newParent.getId(), id)) {
                throw new BusinessException("Không thể chuyển một mục vào chính nó hoặc vào mục con của nó");
            }
            if (newParent.getStatus() != TaxonomyStatus.ACTIVE) {
                throw new BusinessException("Mục cha mới đang không hoạt động. Hãy khôi phục mục đó trước.");
            }
        }
        int newDepth = newParent == null ? 1 : newParent.getDepth() + 1;
        if (newDepth + subtreeHeight(id) - 1 > 3) {
            throw new BusinessException("Cây phân loại chỉ có tối đa 3 cấp: Chuyên đề, Bài, Dạng. Nhánh này quá sâu để đặt vào đây.");
        }
        node.setParentId(newParentId);
        node.setSubject(newParent == null ? node.getSubject() : newParent.getSubject());
        node.setSlug(uniqueSlug(newParentId, slugify(node.getTitle()), id));
        node.setOrderNo(nextOrderNo(newParentId));
        applyDepth(node, newDepth);
        auditService.record("MOVE", TARGET_TYPE, id, "parent_id=" + oldParentId, "parent_id=" + newParentId);
        return toResponse(node);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        TaxonomyNode node = findEntity(id);
        if (node.getStatus() == TaxonomyStatus.MERGED) {
            throw new BusinessException("Mục này đã được gộp vào mục khác nên không xóa được. Hãy xử lý ở mục đích gộp.");
        }
        long children = nodeRepository.countByParentId(id);
        if (children > 0) {
            throw new BusinessException("Mục này còn " + children + " mục con. Hãy xóa hoặc chuyển các mục con đi trước.");
        }
        long documents = documentRepository.countByTaxonomyNodeId(id);
        if (documents > 0) {
            throw new BusinessException("Mục này còn " + documents + " tài liệu. Hãy gỡ tài liệu khỏi mục ở tab \"Nội dung học\" trước.");
        }
        long mergedIn = nodeRepository.countByMergedInto(id);
        if (mergedIn > 0) {
            throw new BusinessException("Có " + mergedIn + " mục đã được gộp vào mục này. Xóa đi sẽ làm mất dấu các mục đó.");
        }
        aliasRepository.findByNodeId(id).forEach(TaxonomyAlias::markDeleted);
        node.markDeleted();
        auditService.record("DELETE", TARGET_TYPE, id, node.getTitle(), null);
    }

    @Override
    @Transactional
    public void reorder(Long parentId, ReorderRequest request) {
        Set<Long> siblingIds = new HashSet<>(nodeRepository.findByParentId(parentId).stream().map(TaxonomyNode::getId).toList());
        for (Long id : request.ids()) {
            if (!siblingIds.contains(id)) {
                throw new BusinessException("Chỉ có thể sắp xếp các mục nằm trong cùng một mục cha");
            }
        }
        for (int i = 0; i < request.ids().size(); i++) {
            findEntity(request.ids().get(i)).setOrderNo(-(i + 1));
        }
        nodeRepository.flush();
        for (int i = 0; i < request.ids().size(); i++) {
            findEntity(request.ids().get(i)).setOrderNo(i + 1);
        }
    }

    @Override
    @Transactional
    public TaxonomyNodeResponse addAlias(Long nodeId, TaxonomyAliasRequest request) {
        TaxonomyNode node = findEntity(nodeId);
        String slug = slugify(request.alias());
        if (aliasRepository.existsByNodeIdAndSlug(nodeId, slug)) {
            throw new BusinessException("Tên gọi khác này đã tồn tại cho mục này");
        }
        TaxonomyAlias alias = new TaxonomyAlias();
        alias.setNodeId(nodeId);
        alias.setAlias(request.alias());
        alias.setSlug(slug);
        aliasRepository.save(alias);
        auditService.record("ADD_ALIAS", TARGET_TYPE, nodeId, null, request.alias());
        return toResponse(node);
    }

    @Override
    @Transactional
    public TaxonomyNodeResponse removeAlias(Long nodeId, Long aliasId) {
        TaxonomyNode node = findEntity(nodeId);
        TaxonomyAlias alias = aliasRepository.findById(aliasId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tên gọi khác: " + aliasId));
        if (!alias.getNodeId().equals(nodeId)) {
            throw new BusinessException("Tên gọi khác không thuộc mục này");
        }
        alias.markDeleted();
        auditService.record("REMOVE_ALIAS", TARGET_TYPE, nodeId, alias.getAlias(), null);
        return toResponse(node);
    }

    @Override
    @Transactional
    public ArchiveResultResponse archive(Long id) {
        TaxonomyNode node = findEntity(id);
        long activeChildren = nodeRepository.countByParentIdAndStatusNotIn(id, INACTIVE);
        if (activeChildren > 0) {
            throw new BusinessException("Mục này còn " + activeChildren + " mục con đang hoạt động. Hãy xử lý các mục con trước, hoặc chọn \"Lưu trữ cả nhánh\".");
        }
        node.setStatus(TaxonomyStatus.ARCHIVED);
        auditService.record("ARCHIVE", TARGET_TYPE, id, "ACTIVE", "ARCHIVED");
        return new ArchiveResultResponse(toResponse(node), 1, 0, 0);
    }

    @Override
    @Transactional
    public ArchiveResultResponse archiveBranch(Long id) {
        TaxonomyNode root = findEntity(id);
        int count = 0;
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(id);
        while (!queue.isEmpty()) {
            Long currentId = queue.poll();
            TaxonomyNode current = findEntity(currentId);
            if (current.getStatus() != TaxonomyStatus.ARCHIVED && current.getStatus() != TaxonomyStatus.MERGED) {
                current.setStatus(TaxonomyStatus.ARCHIVED);
                count++;
            }
            nodeRepository.findByParentId(currentId).forEach(child -> queue.add(child.getId()));
        }
        auditService.record("ARCHIVE_BRANCH", TARGET_TYPE, id, null, count + " mục đã được lưu trữ");
        return new ArchiveResultResponse(toResponse(root), count, 0, 0);
    }

    @Override
    @Transactional
    public TaxonomyNodeResponse unarchive(Long id) {
        TaxonomyNode node = findEntity(id);
        // Đối xứng với archive(): một mục chỉ hoạt động được khi mục cha của nó cũng đang hoạt động,
        // nếu không sẽ có mục "sống" nằm trong nhánh đã lưu trữ và không ai nhìn thấy nó.
        if (node.getParentId() != null) {
            TaxonomyNode parent = findEntity(node.getParentId());
            if (parent.getStatus() != TaxonomyStatus.ACTIVE) {
                throw new BusinessException("Mục cha \"" + parent.getTitle() + "\" đang không hoạt động. Hãy khôi phục mục cha trước.");
            }
        }
        node.setStatus(TaxonomyStatus.ACTIVE);
        auditService.record("UNARCHIVE", TARGET_TYPE, id, "ARCHIVED", "ACTIVE");
        return toResponse(node);
    }

    @Override
    @Transactional
    public void merge(MergeRequest request) {
        if (request.sourceId().equals(request.targetId())) {
            throw new BusinessException("Không thể gộp một mục vào chính nó");
        }
        TaxonomyNode source = findEntity(request.sourceId());
        TaxonomyNode target = findEntity(request.targetId());
        if (source.getStatus() == TaxonomyStatus.MERGED) {
            throw new BusinessException("Mục nguồn đã được gộp trước đó");
        }
        if (!source.getDepth().equals(target.getDepth())) {
            throw new BusinessException("Chỉ có thể gộp hai mục cùng cấp");
        }
        String oldTitle = source.getTitle();
        String oldSlug = source.getSlug();
        source.setStatus(TaxonomyStatus.MERGED);
        source.setMergedInto(target.getId());
        String aliasSlug = uniqueAliasSlug(target.getId(), oldSlug);
        if (!aliasRepository.existsByNodeIdAndSlug(target.getId(), aliasSlug)) {
            TaxonomyAlias alias = new TaxonomyAlias();
            alias.setNodeId(target.getId());
            alias.setAlias(oldTitle);
            alias.setSlug(aliasSlug);
            aliasRepository.save(alias);
        }
        auditService.record("MERGE", TARGET_TYPE, source.getId(), oldTitle, "merged_into=" + target.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DuplicateSuggestionResponse> duplicateSuggestions() {
        return nodeRepository.findDuplicateSuggestions().stream()
                .map(p -> new DuplicateSuggestionResponse(p.getNodeAId(), p.getNodeATitle(), p.getNodeBId(), p.getNodeBTitle(), p.getSimilarity()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLogResponse> history(Long id) {
        findEntity(id);
        return auditLogRepository.findByTargetTypeAndTargetIdOrderByCreatedAtDesc(TARGET_TYPE, id).stream()
                .map(this::toAuditResponse).toList();
    }

    /** True khi candidateId chính là ancestorId hoặc nằm trong nhánh con của ancestorId. */
    private boolean isSelfOrDescendantOf(Long candidateId, Long ancestorId) {
        Long cursor = candidateId;
        for (int guard = 0; cursor != null && guard < 10; guard++) {
            if (cursor.equals(ancestorId)) {
                return true;
            }
            cursor = findEntity(cursor).getParentId();
        }
        return false;
    }

    /** Số cấp của nhánh tính từ chính mục này (mục không có con = 1). */
    private int subtreeHeight(Long id) {
        int max = 0;
        for (TaxonomyNode child : nodeRepository.findByParentId(id)) {
            max = Math.max(max, subtreeHeight(child.getId()));
        }
        return max + 1;
    }

    /** Đặt lại depth cho mục và toàn bộ nhánh con sau khi đổi mục cha. */
    private void applyDepth(TaxonomyNode node, int depth) {
        node.setDepth(depth);
        for (TaxonomyNode child : nodeRepository.findByParentId(node.getId())) {
            applyDepth(child, depth + 1);
        }
    }

    private TaxonomyNode findEntity(Long id) {
        return nodeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mục phân loại: " + id));
    }

    private int nextOrderNo(Long parentId) {
        return nodeRepository.findByParentId(parentId).stream()
                .mapToInt(TaxonomyNode::getOrderNo).max().orElse(0) + 1;
    }

    private String uniqueSlug(Long parentId, String baseSlug, Long excludeId) {
        List<TaxonomyNode> siblings = nodeRepository.findByParentId(parentId);
        String candidate = baseSlug;
        int i = 2;
        while (isSlugTaken(siblings, candidate, excludeId)) {
            candidate = baseSlug + "-" + (i++);
        }
        return candidate;
    }

    private boolean isSlugTaken(List<TaxonomyNode> siblings, String candidate, Long excludeId) {
        for (TaxonomyNode n : siblings) {
            if (n.getSlug().equals(candidate) && !n.getId().equals(excludeId)) {
                return true;
            }
        }
        return false;
    }

    private String uniqueAliasSlug(Long nodeId, String baseSlug) {
        List<TaxonomyAlias> existing = aliasRepository.findByNodeId(nodeId);
        String candidate = baseSlug;
        int i = 2;
        while (isAliasSlugTaken(existing, candidate)) {
            candidate = baseSlug + "-" + (i++);
        }
        return candidate;
    }

    private boolean isAliasSlugTaken(List<TaxonomyAlias> existing, String candidate) {
        for (TaxonomyAlias a : existing) {
            if (a.getSlug().equals(candidate)) {
                return true;
            }
        }
        return false;
    }

    private String slugify(String input) {
        String replaced = input.replace('đ', 'd').replace('Đ', 'D');
        String normalized = Normalizer.normalize(replaced, Normalizer.Form.NFD);
        String noDiacritics = normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        String slug = noDiacritics.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isBlank() ? "muc-" + System.currentTimeMillis() : slug;
    }

    /** Đếm tài liệu cho từng mục trong một truy vấn — dùng khi dựng cả cây. */
    private Map<Long, Integer> documentCountsByNode() {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : documentRepository.countGroupedByTaxonomyNode()) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    /** Dùng cho thao tác trên đúng một mục (tạo/sửa/lưu trữ…) — đếm lẻ, không cần map cả cây. */
    private TaxonomyNodeResponse toResponse(TaxonomyNode node) {
        return toResponse(node, (int) documentRepository.countByTaxonomyNodeId(node.getId()));
    }

    private TaxonomyNodeResponse toResponse(TaxonomyNode node, int documentCount) {
        List<TaxonomyAliasView> aliases = aliasRepository.findByNodeId(node.getId()).stream()
                .sorted(Comparator.comparing(TaxonomyAlias::getAlias))
                .map(a -> new TaxonomyAliasView(a.getId(), a.getAlias()))
                .toList();
        return new TaxonomyNodeResponse(
                node.getId(), node.getParentId(), node.getDepth(), node.getTitle(), node.getDescription(),
                node.getSlug(), node.getOrderNo(), node.getProposedBy(), node.getStatus(), node.getMergedInto(),
                0, 0, documentCount, 0, aliases
        );
    }

    private AuditLogResponse toAuditResponse(AuditLog log) {
        return new AuditLogResponse(log.getId(), log.getActorUserId(), log.getAction(), log.getTargetType(),
                log.getTargetId(), log.getIpAddress(), log.getOldData(), log.getNewData(), log.getCreatedAt());
    }
}
