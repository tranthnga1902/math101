-- Chấm tự luận theo từng câu. Trước lát này một bài nộp chỉ có đúng một điểm tổng và một ô nhận
-- xét chung, nên với đề tự luận giáo viên không có chỗ nào ghi "câu 3 thiếu bước biện luận" —
-- và học sinh chỉ nhận về một con số, không biết mất điểm ở đâu.

create table submission_item_grades (
    id bigserial primary key,
    progress_id bigint not null references assignment_progress(id),
    problem_id bigint not null references problems(id),
    -- Để trống nghĩa là giáo viên chưa chấm câu này. Phải phân biệt được với 0 điểm: chấm dở
    -- nửa chừng mà máy hiểu là 0 thì tổng chốt ra thấp hơn thực tế.
    score numeric(5,2),
    -- Chép lại điểm tối đa của câu tại lúc chấm. Nếu tính lại từ số câu của đề mỗi lần đọc thì
    -- thêm hay bớt một câu trong phiếu sẽ lặng lẽ đổi thang điểm của những bài đã chấm xong.
    max_score numeric(5,2) not null,
    feedback text,
    created_at timestamp not null,
    updated_at timestamp not null,
    -- Có mặt để khớp BaseEntity và qua được ddl-auto=validate, nhưng dòng ở bảng này bị **xoá
    -- thẳng** chứ không đánh dấu xoá: ràng buộc duy nhất bên dưới không tính deleted_at, nên một
    -- dòng đánh dấu xoá vẫn chiếm chỗ và lần chấm sau sẽ đâm vào ràng buộc đó.
    deleted_at timestamp,
    constraint uq_submission_item unique (progress_id, problem_id),
    constraint ck_submission_item_max check (max_score > 0),
    constraint ck_submission_item_score check (score is null or (score >= 0 and score <= max_score))
);

-- Đường đọc duy nhất là "lấy toàn bộ điểm từng câu của một bài nộp".
create index idx_submission_item_progress on submission_item_grades (progress_id);
