package com.math10.programs;

import com.math10.configuration.security.CurrentUserService;
import com.math10.documents.service.DocumentService;
import com.math10.programs.controller.ProgramDocumentController;
import com.math10.programs.support.LuongNoiDung;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ProgramDocumentControllerTest {
    final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    final CurrentUserService current=mock(CurrentUserService.class);
    final LuongNoiDung rules=mock(LuongNoiDung.class);
    final DocumentService documents=mock(DocumentService.class);
    final ProgramDocumentController controller=new ProgramDocumentController(jdbc,current,rules,documents);

    @Test void chanMoiDuongMoTruocKhiDocTep() {
        when(current.requireRoleCode()).thenReturn("STUDENT");
        when(current.requireUserId()).thenReturn(10L);
        assertThatThrownBy(()->controller.content(5L,"pdf")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.preview(5L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.launch(5L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(documents,jdbc);
    }

    @Test void docTepVaXemOfficeQuaCungQuyenPhanPhoi() {
        when(current.requireRoleCode()).thenReturn("STUDENT");
        when(current.requireUserId()).thenReturn(10L);
        when(rules.moDuocMuc(5L,10L)).thenReturn(true);
        when(jdbc.queryForList(anyString(),eq(5L))).thenReturn(List.of(Map.of("id",7L,"file_url","https://example.test/file.docx")));
        when(documents.readDocumentBytes(7L)).thenReturn(new byte[]{1});
        when(documents.readDocumentPreviewPdf(7L)).thenReturn(new byte[]{2});
        when(documents.launchDocumentPackage(7L)).thenReturn("/launch/test");
        assertThat(controller.content(5L,"pdf").getBody()).containsExactly((byte)1);
        assertThat(controller.content(5L,"pdf").getHeaders().getContentType().toString()).contains("wordprocessingml");
        assertThat(controller.preview(5L).getBody()).containsExactly((byte)2);
        assertThat(controller.launch(5L).data()).containsEntry("launchUrl","/launch/test");
    }
}
