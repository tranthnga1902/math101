import type { AnswerReveal, ClassRequirement, LatePolicy, TaskKind } from "../../api";

/**
 * Ba loại nhiệm vụ chỉ là <b>ba bộ giá trị mặc định</b>, không phải ba mô hình dữ liệu.
 *
 * <p>Sau khi bấm chọn loại thì mọi ô vẫn sửa được, và server không có nhánh `if (task_kind == …)`
 * nào trong luật vòng đời — `AssignmentWindow` không biết loại nhiệm vụ tồn tại. Để loại nhiệm vụ
 * đổi cách chấm hay cách mở bài là cách sinh ra hai luật vòng đời lệch nhau.
 *
 * <p>`maxAttempts: 0` là <b>không giới hạn</b> chứ không phải cấm nộp — đúng như javadoc của
 * `Assignment.maxAttempts`. Luyện tự do lấy 0 vì mục đích của nó là làm đi làm lại.
 *
 * <p>`requirement` cũng nằm ở đây dù nó là trục riêng: bài luyện tự do mà mặc định "bắt buộc" thì
 * mẫu số bài bắt buộc của cả lớp phồng lên vì một thứ không ai bắt buộc phải làm.
 */
export type BoMacDinh = {
  nhan: string;
  moTa: string;
  taskKind: TaskKind;
  requirement: ClassRequirement;
  maxAttempts: number;
  latePolicy: LatePolicy;
  latePenaltyPercent: number;
  answerReveal: AnswerReveal;
  countsInGradebook: boolean;
};

export const BO_MAC_DINH: BoMacDinh[] = [
  {
    nhan: "Bài tập",
    moTa: "3 lượt · muộn trừ 20% · thấy đáp án sau khi nộp",
    taskKind: "BAI_TAP", requirement: "BAT_BUOC",
    maxAttempts: 3, latePolicy: "PENALTY", latePenaltyPercent: 20,
    answerReveal: "AFTER_SUBMIT", countsInGradebook: true,
  },
  {
    nhan: "Bài kiểm tra",
    moTa: "1 lượt · quá hạn không nhận · thấy đáp án khi trả bài",
    taskKind: "BAI_KIEM_TRA", requirement: "BAT_BUOC",
    maxAttempts: 1, latePolicy: "REJECT", latePenaltyPercent: 0,
    answerReveal: "AFTER_RETURN", countsInGradebook: true,
  },
  {
    nhan: "Luyện tự do",
    moTa: "làm lại thoải mái · không hạn · thấy đáp án ngay · không vào điểm",
    taskKind: "LUYEN_TU_DO", requirement: "TU_CHON",
    maxAttempts: 0, latePolicy: "REJECT", latePenaltyPercent: 0,
    answerReveal: "IMMEDIATE", countsInGradebook: false,
  },
];

export const macDinhCua = (kind: TaskKind) => BO_MAC_DINH.find(bo => bo.taskKind === kind) ?? BO_MAC_DINH[0];

export const nhanLoai: Record<TaskKind, string> = {
  BAI_TAP: "Bài tập", BAI_KIEM_TRA: "Bài kiểm tra", LUYEN_TU_DO: "Luyện tự do",
};

export const nhanHienDapAn: Record<AnswerReveal, string> = {
  AFTER_SUBMIT: "Ngay sau khi nộp",
  AFTER_RETURN: "Khi giáo viên trả bài",
  IMMEDIATE: "Ngay lập tức, kể cả chưa nộp",
};
