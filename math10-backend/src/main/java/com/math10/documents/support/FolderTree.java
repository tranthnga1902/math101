package com.math10.documents.support;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phép tính trên cây thư mục, tách khỏi JPA để thử được bằng bảng cha/con viết tay.
 * Đầu vào là ánh xạ id → id cha (null = gốc).
 */
public final class FolderTree {

    /** Độ sâu tối đa tính cả thư mục gốc — đủ cho Khối › Chuyên đề › Bài › Dạng › …, không để cây mọc vô hạn. */
    public static final int MAX_DEPTH = 8;

    private FolderTree() {
    }

    /** Đặt {@code folderId} dưới {@code newParentId} có tạo vòng không (gồm cả tự làm cha chính mình). */
    public static boolean wouldCreateCycle(Map<Long, Long> parentOf, Long folderId, Long newParentId) {
        Set<Long> seen = new HashSet<>();
        for (Long cursor = newParentId; cursor != null; cursor = parentOf.get(cursor)) {
            if (cursor.equals(folderId) || !seen.add(cursor)) {
                return true;
            }
        }
        return false;
    }

    /** Độ sâu của thư mục (gốc = 1). */
    public static int depthOf(Map<Long, Long> parentOf, Long folderId) {
        int depth = 0;
        Set<Long> seen = new HashSet<>();
        for (Long cursor = folderId; cursor != null && seen.add(cursor); cursor = parentOf.get(cursor)) {
            depth++;
        }
        return depth;
    }

    /** Chiều cao nhánh con tính từ thư mục (chỉ mình nó = 1). */
    public static int subtreeHeight(Map<Long, Long> parentOf, Long folderId) {
        Map<Long, List<Long>> children = childrenOf(parentOf);
        int height = 0;
        Deque<Long> level = new ArrayDeque<>(List.of(folderId));
        Set<Long> seen = new HashSet<>();
        while (!level.isEmpty()) {
            height++;
            Deque<Long> next = new ArrayDeque<>();
            for (Long id : level) {
                if (seen.add(id)) {
                    next.addAll(children.getOrDefault(id, List.of()));
                }
            }
            level = next;
        }
        return height;
    }

    /** Thư mục và mọi thư mục con cháu của nó. */
    public static Set<Long> subtreeOf(Map<Long, Long> parentOf, Long folderId) {
        Map<Long, List<Long>> children = childrenOf(parentOf);
        Set<Long> result = new LinkedHashSet<>();
        Deque<Long> stack = new ArrayDeque<>(List.of(folderId));
        while (!stack.isEmpty()) {
            Long id = stack.pop();
            if (result.add(id)) {
                children.getOrDefault(id, List.of()).forEach(stack::push);
            }
        }
        return result;
    }

    private static Map<Long, List<Long>> childrenOf(Map<Long, Long> parentOf) {
        Map<Long, List<Long>> children = new HashMap<>();
        parentOf.forEach((id, parent) -> {
            if (parent != null) {
                children.computeIfAbsent(parent, key -> new java.util.ArrayList<>()).add(id);
            }
        });
        return children;
    }
}
