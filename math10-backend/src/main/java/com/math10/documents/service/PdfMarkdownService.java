package com.math10.documents.service;

import com.math10.common.exception.BusinessException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Trích xuất nội dung văn bản từ PDF sang Markdown "tối giản" bằng PDFBox (mã nguồn mở,
 * không gọi AI/OCR). Chỉ là văn bản thô chia đoạn + đoán tiêu đề bằng heuristic đơn giản —
 * không nhận dạng bảng/công thức toán, và không xử lý được PDF dạng ảnh/scan.
 */
@Service
public class PdfMarkdownService {

    private static final int MIN_EXTRACTED_LENGTH = 20;
    private static final int HEADING_MAX_LENGTH = 80;

    public String extractMarkdown(InputStream pdfStream) throws IOException {
        String rawText;
        try (PDDocument document = Loader.loadPDF(pdfStream.readAllBytes())) {
            if (document.getNumberOfPages() == 0) {
                throw new BusinessException("PDF rỗng, không có nội dung để chuyển đổi");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            rawText = stripper.getText(document);
        }

        String markdown = toMarkdown(rawText);
        if (markdown.trim().length() < MIN_EXTRACTED_LENGTH) {
            throw new BusinessException("Không trích xuất được văn bản — có thể là PDF dạng ảnh/scan");
        }
        return markdown;
    }

    private String toMarkdown(String rawText) {
        String[] lines = rawText.replace("\r\n", "\n").replace("\r", "\n").split("\n", -1);
        List<String> paragraphs = new ArrayList<>();
        StringBuilder current = new StringBuilder();

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                flushParagraph(current, paragraphs, lines, i);
                continue;
            }
            if (current.length() > 0) {
                current.append('\n');
            }
            current.append(line);
        }
        flushParagraph(current, paragraphs, lines, lines.length);

        return String.join("\n\n", paragraphs);
    }

    private void flushParagraph(StringBuilder current, List<String> paragraphs, String[] lines, int nextIndex) {
        if (current.length() == 0) {
            return;
        }
        String block = current.toString();
        current.setLength(0);
        if (isLikelyHeading(block, lines, nextIndex)) {
            paragraphs.add("## " + block);
        } else {
            paragraphs.add(block);
        }
    }

    /** Heuristic: 1 dòng, ngắn, không kết thúc bằng dấu câu kết câu → coi như tiêu đề. */
    private boolean isLikelyHeading(String block, String[] lines, int nextIndex) {
        if (block.contains("\n") || block.length() > HEADING_MAX_LENGTH) {
            return false;
        }
        char last = block.charAt(block.length() - 1);
        if (last == '.' || last == ',' || last == ';') {
            return false;
        }
        boolean precededByBlank = nextIndex - 2 < 0 || lines[nextIndex - 2].trim().isEmpty();
        return precededByBlank;
    }
}
