package com.math10.assignments.service;

import com.math10.assignments.domain.ChamDiemCauHoi;
import com.math10.assignments.domain.McqGrading;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.List;

/** Reads immutable answer keys from either legacy problems or pipeline snapshots. */
@Component
@RequiredArgsConstructor
public class WorksheetAnswerKeys {
    private final JdbcTemplate jdbc;

    public List<McqGrading.Key> of(Long worksheetId) {
        return of(worksheetId, null);
    }

    public List<McqGrading.Key> of(Long worksheetId, Long worksheetVersionId) {
        String versionFilter = worksheetVersionId == null ? "" : " and wi.worksheet_version_id=?";
        String sql = """
                select coalesce(wi.problem_id,-wi.id) item_key,
                       coalesce(p.correct_option,wi.answer_snapshot) correct_option,
                       coalesce(p.option_a,wi.option_a_snapshot) option_a,
                       coalesce(p.option_b,wi.option_b_snapshot) option_b,
                       coalesce(p.option_c,wi.option_c_snapshot) option_c,
                       coalesce(p.option_d,wi.option_d_snapshot) option_d,
                       wi.question_type_snapshot question_type,
                       wi.answer_payload_snapshot::text answer_payload,
                       wi.max_score max_score
                from worksheet_items wi left join problems p on p.id=wi.problem_id and p.deleted_at is null
                where wi.worksheet_id=? and wi.deleted_at is null""" + versionFilter + " order by wi.order_index";
        Object[] args = worksheetVersionId == null ? new Object[]{worksheetId} : new Object[]{worksheetId, worksheetVersionId};
        return jdbc.query(sql, (rs, n) -> {
            String a=rs.getString("option_a"), b=rs.getString("option_b"), c=rs.getString("option_c"), d=rs.getString("option_d"), answer=rs.getString("correct_option");
            long itemKey = rs.getLong("item_key");
            // Câu của bảng problems (item_key dương) và câu chưa nhận ra kiểu đều để kiểu rỗng, rơi
            // về phép suy sẵn có — phiếu đã chấm trước lát này phải giữ nguyên điểm.
            String kieu = itemKey > 0 ? null : rs.getString("question_type");
            if (kieu != null && (kieu.isBlank() || "UNKNOWN".equals(kieu))) kieu = null;
            boolean mayCham = kieu == null
                    ? McqGrading.laTracNghiem(a, b, c, d, answer)
                    : !ChamDiemCauHoi.TU_LUAN.equals(kieu);
            return new McqGrading.Key(itemKey, answer, mayCham,
                    kieu, rs.getString("answer_payload"), rs.getBigDecimal("max_score"));
        }, args);
    }
}

