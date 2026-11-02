package com.math10.documents.support;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FolderTreeTest {

    /** 1 ─┬─ 2 ── 4
     *     └─ 3
     *  5 (gốc riêng) */
    private static Map<Long, Long> cay() {
        Map<Long, Long> parentOf = new HashMap<>();
        parentOf.put(1L, null);
        parentOf.put(2L, 1L);
        parentOf.put(3L, 1L);
        parentOf.put(4L, 2L);
        parentOf.put(5L, null);
        return parentOf;
    }

    @Test
    void khongDuocLamChaChinhMinhHayConChau() {
        assertThat(FolderTree.wouldCreateCycle(cay(), 1L, 1L)).isTrue();
        assertThat(FolderTree.wouldCreateCycle(cay(), 1L, 4L)).isTrue();
        assertThat(FolderTree.wouldCreateCycle(cay(), 2L, 4L)).isTrue();
    }

    @Test
    void chuyenSangNhanhKhacHoacRaGocLaHopLe() {
        assertThat(FolderTree.wouldCreateCycle(cay(), 2L, 3L)).isFalse();
        assertThat(FolderTree.wouldCreateCycle(cay(), 4L, 5L)).isFalse();
        assertThat(FolderTree.wouldCreateCycle(cay(), 4L, null)).isFalse();
    }

    @Test
    void doSauVaChieuCaoNhanh() {
        assertThat(FolderTree.depthOf(cay(), 1L)).isEqualTo(1);
        assertThat(FolderTree.depthOf(cay(), 4L)).isEqualTo(3);
        assertThat(FolderTree.subtreeHeight(cay(), 1L)).isEqualTo(3);
        assertThat(FolderTree.subtreeHeight(cay(), 3L)).isEqualTo(1);
    }

    @Test
    void nhanhConGomMoiThuMucConChau() {
        assertThat(FolderTree.subtreeOf(cay(), 1L)).containsExactlyInAnyOrder(1L, 2L, 3L, 4L);
        assertThat(FolderTree.subtreeOf(cay(), 5L)).containsExactly(5L);
    }

    @Test
    void duLieuHongCoVongThiKhongTreo() {
        Map<Long, Long> hong = new HashMap<>();
        hong.put(1L, 2L);
        hong.put(2L, 1L);
        assertThat(FolderTree.wouldCreateCycle(hong, 3L, 1L)).isTrue();
        assertThat(FolderTree.depthOf(hong, 1L)).isEqualTo(2);
        assertThat(FolderTree.subtreeOf(hong, 1L)).containsExactlyInAnyOrder(1L, 2L);
    }
}
