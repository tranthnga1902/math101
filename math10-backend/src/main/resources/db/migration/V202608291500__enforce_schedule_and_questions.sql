-- The database, not only the HTTP service, owns the no-overlap invariant.
CREATE OR REPLACE FUNCTION reject_overlapping_program_schedule() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM program_schedules other
    WHERE other.id <> COALESCE(NEW.id, -1)
      AND other.deleted_at IS NULL AND other.status = 'ACTIVE'
      AND COALESCE(other.course_instance_id, -1) = COALESCE(NEW.course_instance_id, -1)
      AND other.course_id = NEW.course_id
      AND daterange(other.starts_on, other.ends_on, '[]') && daterange(NEW.starts_on, NEW.ends_on, '[]')
  ) THEN RAISE EXCEPTION 'Program schedule periods must not overlap' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS program_schedule_no_overlap ON program_schedules;
CREATE TRIGGER program_schedule_no_overlap BEFORE INSERT OR UPDATE OF course_id,course_instance_id,starts_on,ends_on,status,deleted_at
ON program_schedules FOR EACH ROW WHEN (NEW.deleted_at IS NULL AND NEW.status='ACTIVE') EXECUTE FUNCTION reject_overlapping_program_schedule();

CREATE TABLE worksheet_questions (
  id BIGSERIAL PRIMARY KEY,
  worksheet_id BIGINT NOT NULL REFERENCES worksheets(id),
  source_problem_id BIGINT REFERENCES problems(id),
  question_type VARCHAR(30) NOT NULL DEFAULT 'FREE_RESPONSE',
  prompt TEXT NOT NULL,
  answer_key JSONB,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (max_score >= 0),
  order_index INTEGER NOT NULL CHECK (order_index > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now(), deleted_at TIMESTAMP,
  UNIQUE (worksheet_id, order_index)
);
CREATE INDEX idx_worksheet_questions_sheet ON worksheet_questions(worksheet_id) WHERE deleted_at IS NULL;

-- Bảng để rỗng, cố ý. Bản backfill trước đó đổ từ worksheet_items với ba cột đặt cứng —
-- question_type='FREE_RESPONSE', answer_key=NULL, max_score=1 — trong khi ngân hàng có cả trắc
-- nghiệm, có đáp án, và WorksheetScoring chấm theo trần điểm từng câu. Chưa ai đọc bảng này, nên
-- cái hại không phải là chấm sai hôm nay mà là người mở CSDL lần sau thấy một bảng đầy dữ liệu
-- trông như đã dùng được. Bảng rỗng nói đúng sự thật; đổ đầy dữ liệu sai thì không.
--
-- Khi có đường ghi thật thì backfill lại từ nguồn biết phân loại câu: McqGrading.laTracNghiem là
-- chỗ duy nhất trong repo quyết định câu nào là trắc nghiệm (xem HT-54).
