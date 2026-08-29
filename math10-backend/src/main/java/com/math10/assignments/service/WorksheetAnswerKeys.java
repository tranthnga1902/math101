package com.math10.assignments.service;

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
                       coalesce(p.option_d,wi.option_d_snapshot) option_d
                from worksheet_items wi left join problems p on p.id=wi.problem_id and p.deleted_at is null
                where wi.worksheet_id=? and wi.deleted_at is null""" + versionFilter + " order by wi.order_index";
        Object[] args = worksheetVersionId == null ? new Object[]{worksheetId} : new Object[]{worksheetId, worksheetVersionId};
        return jdbc.query(sql, (rs, n) -> {
            String a=rs.getString("option_a"), b=rs.getString("option_b"), c=rs.getString("option_c"), d=rs.getString("option_d"), answer=rs.getString("correct_option");
            return new McqGrading.Key(rs.getLong("item_key"), answer, McqGrading.laTracNghiem(a,b,c,d,answer));
        }, args);
    }
}
