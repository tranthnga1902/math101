package com.math10.documents.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;

@Service
public class PdfThumbnailService {

    public byte[] renderFirstPagePng(InputStream pdfStream, int targetWidth) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfStream.readAllBytes())) {
            if (document.getNumberOfPages() == 0) {
                throw new IOException("PDF rỗng");
            }
            PDFRenderer renderer = new PDFRenderer(document);
            BufferedImage image = renderer.renderImageWithDPI(0, 110f, ImageType.RGB);
            int srcW = image.getWidth();
            int srcH = image.getHeight();
            if (srcW > targetWidth) {
                int targetHeight = Math.max(1, Math.round((float) srcH * targetWidth / srcW));
                BufferedImage resized = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
                resized.createGraphics().drawImage(image, 0, 0, targetWidth, targetHeight, null);
                image = resized;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        }
    }
}