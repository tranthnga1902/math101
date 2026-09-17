/**
 * Schema chuẩn cho bài học có cấu trúc (Structured Lesson Document).
 * Cả AI sinh bài học lẫn Giáo viên biên tập qua Editor đều tuân thủ cùng một schema này.
 * KHÔNG LƯU CLASS CSS HAY TAILWIND TRONG NỘI DUNG NÀY.
 */

export const AI_LESSON_SCHEMA_DOC = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "1. Mệnh đề, mệnh đề toán học" }]
    },
    {
      type: "definitionBlock",
      attrs: { title: "Định nghĩa" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Mệnh đề logic (gọi tắt là mệnh đề) là một câu khẳng định có tính đúng hoặc sai rõ ràng."
            }
          ]
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Một mệnh đề không thể vừa đúng vừa sai." }]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Các câu hỏi, câu cảm thán không phải là mệnh đề logic." }]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: "exampleBlock",
      attrs: { title: "Ví dụ 1" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "“Hà Nội là thủ đô của Việt Nam” là một mệnh đề đúng."
            }
          ]
        }
      ]
    },
    {
      type: "formulaBlock",
      attrs: { latex: "f(x) = ax^2 + bx + c \\quad (a \\neq 0)" }
    },
    {
      type: "noteBlock",
      attrs: { title: "Ghi chú quan trọng" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Quy ước kí hiệu: Với mọi (∀) và tồn tại (∃)."
            }
          ]
        }
      ]
    },
    {
      type: "warningBlock",
      attrs: { title: "Lỗi thường gặp" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Tránh nhầm lẫn giữa mệnh đề phủ định và mệnh đề đảo."
            }
          ]
        }
      ]
    }
  ]
};

/**
 * Trả về prompt chỉ dẫn hệ thống cho AI khi cần sinh bài học theo cấu trúc chuẩn.
 */
export function getAiLessonPromptInstructions(): string {
  return `Bạn là chuyên gia sư phạm Toán học. Khi tạo nội dung bài học lý thuyết, bạn PHẢI xuất ra dưới dạng JSON cấu trúc (Structured Lesson Document) theo đặc tả sau:
- KHÔNG sử dụng các thẻ HTML <div class="..."> hay mã CSS Tailwind.
- Cấu trúc gốc phải là:
  {
    "type": "doc",
    "content": [ ...các khối... ]
  }
- Các loại khối được hỗ trợ:
  1. "heading": attrs { "level": 1 | 2 | 3 }
  2. "paragraph": đoạn văn bản thông thường
  3. "bulletList" & "orderedList": danh sách với các "listItem"
  4. "definitionBlock": khối định nghĩa, attrs { "title": "Định nghĩa" }
  5. "exampleBlock": khối ví dụ, attrs { "title": "Ví dụ X" }
  6. "noteBlock": khối ghi chú, attrs { "title": "Ghi chú" }
  7. "warningBlock": khối cảnh báo/lưu ý, attrs { "title": "Cảnh báo" }
  8. "formulaBlock": khối công thức toán hiển thị riêng dòng, attrs { "latex": "mã_latex" }
  9. "table": bảng dữ liệu với "tableRow", "tableHeader", "tableCell"
- Đối với công thức toán nằm trong dòng, viết trực tiếp dạng $công_thức_latex$ trong đoạn text.`;
}
