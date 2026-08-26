package com.math10.worksheets.service;

import com.math10.common.exception.BusinessException;
import com.math10.worksheets.dto.WorksheetImportDtos.Preview;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import java.io.InputStream;

@Service @RequiredArgsConstructor
public class PdfWorksheetParser {
    private final DocxWorksheetParser structuredParser;
    public Preview parse(String fileName,InputStream input){try(PDDocument document=Loader.loadPDF(input.readAllBytes())){if(document.isEncrypted())throw new BusinessException("PDF đang được bảo vệ bằng mật khẩu");PDFTextStripper stripper=new PDFTextStripper();stripper.setSortByPosition(true);return structuredParser.parsePlainText(fileName,stripper.getText(document));}catch(BusinessException e){throw e;}catch(Exception e){throw new BusinessException("Không thể đọc file PDF: "+e.getMessage());}}
}
