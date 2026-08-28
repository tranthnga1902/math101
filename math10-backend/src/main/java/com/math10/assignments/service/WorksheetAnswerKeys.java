package com.math10.assignments.service;

import com.math10.assignments.domain.McqGrading;
import com.math10.mathcontent.entity.Problem;
import com.math10.mathcontent.repository.ProblemRepository;
import com.math10.worksheets.repository.WorksheetItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Đọc đáp án đúng của một phiếu đề. Cả đường học sinh nộp bài lẫn đường giáo viên chấm lại và
 * thống kê đều lấy đề qua đây, để {@link McqGrading} luôn nhận cùng một danh sách câu hỏi.
 *
 * <p>Nạp cả phiếu bằng một truy vấn. Trước đây mỗi câu một lần {@code findById} nằm trong vòng
 * lặp học sinh, nên chấm lại một lớp 40 em đề 20 câu là 800 lượt hỏi cơ sở dữ liệu.
 */
@Component
@RequiredArgsConstructor
public class WorksheetAnswerKeys {

    private final WorksheetItemRepository worksheetItems;
    private final ProblemRepository problems;

    /** Đáp án đúng của phiếu, giữ nguyên thứ tự câu trong đề. */
    public List<McqGrading.Key> of(Long worksheetId) {
        var items = worksheetItems.findByWorksheetIdOrderByOrderIndex(worksheetId);
        Map<Long, McqGrading.Key> keyByProblem = new HashMap<>();
        problems.findAllById(items.stream().map(item -> item.getProblemId()).toList())
                .forEach(problem -> keyByProblem.put(problem.getId(),
                        new McqGrading.Key(problem.getId(), problem.getCorrectOption(), laTracNghiem(problem))));
        return items.stream()
                .map(item -> keyByProblem.getOrDefault(item.getProblemId(),
                        new McqGrading.Key(item.getProblemId(), null)))
                .toList();
    }

    /** Luật trắc nghiệm/tự luận nằm ở {@link McqGrading#laTracNghiem}; đây chỉ là chỗ rút field ra. */
    private static boolean laTracNghiem(Problem problem) {
        return McqGrading.laTracNghiem(problem.getOptionA(), problem.getOptionB(),
                problem.getOptionC(), problem.getOptionD(), problem.getCorrectOption());
    }
}
