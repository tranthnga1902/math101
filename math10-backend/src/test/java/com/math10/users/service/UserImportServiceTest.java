package com.math10.users.service;

import com.math10.common.storage.R2StorageServiceImpl;
import com.math10.users.repository.UserRepository;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserImportServiceTest {
    @Mock R2StorageServiceImpl storage;
    @Mock UserRepository users;
    @Mock PasswordEncoder passwordEncoder;

    @Test
    void previewsValidAndInvalidRowsWithoutReturningPasswords() throws Exception {
        when(storage.readObject("admin/user-imports/test.xlsx")).thenReturn(workbookBytes());
        var service = new UserImportService(storage, users, passwordEncoder);

        var preview = service.preview("admin/user-imports/test.xlsx");

        assertThat(preview.totalRows()).isEqualTo(2);
        assertThat(preview.validRows()).isEqualTo(1);
        assertThat(preview.invalidRows()).isEqualTo(1);
        assertThat(preview.rows().get(0).password()).isEqualTo("password-123");
        assertThat(preview.rows().get(1).errors()).isNotEmpty();
    }

    @Test
    void confirmsOnlyValidNonDuplicateRows() throws Exception {
        when(storage.readObject("admin/user-imports/test.xlsx")).thenReturn(workbookBytes());
        when(passwordEncoder.encode("password-123")).thenReturn("hash");
        var service = new UserImportService(storage, users, passwordEncoder);

        var result = service.confirm("admin/user-imports/test.xlsx");

        assertThat(result.created()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(1);
        verify(users).save(any());
    }

    private byte[] workbookBytes() throws Exception {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("accounts");
            var header = sheet.createRow(0);
            String[] names = {"username", "email", "fullName", "phone", "roleCode", "status", "password"};
            for (int index = 0; index < names.length; index++) header.createCell(index).setCellValue(names[index]);
            var valid = sheet.createRow(1);
            String[] validValues = {"student.one", "student.one@example.edu.vn", "Nguyễn Văn A", "", "STUDENT", "ACTIVE", "password-123"};
            for (int index = 0; index < validValues.length; index++) valid.createCell(index).setCellValue(validValues[index]);
            var invalid = sheet.createRow(2);
            String[] invalidValues = {"bad user", "not-an-email", "", "", "UNKNOWN", "ACTIVE", "short"};
            for (int index = 0; index < invalidValues.length; index++) invalid.createCell(index).setCellValue(invalidValues[index]);
            workbook.write(output);
            return output.toByteArray();
        }
    }
}
