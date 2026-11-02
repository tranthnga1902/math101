package com.math10.programs;

import com.math10.programs.dto.ProgramCourseImportDtos.Preview;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;

import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class ProgramCourseImportTest {
    @Autowired ProgramCourseImportService service;
    @Autowired JdbcTemplate jdbc;

    @Test void previewKhongGhiVaConfirmGhiDuBonTang() throws Exception {
        String code="PPCT_"+System.nanoTime();
        byte[] xlsx=workbook(code);
        long before=jdbc.queryForObject("select count(*) from courses",Long.class);
        Preview preview=service.preview(new MockMultipartFile("file","ppct.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",xlsx));
        assertThat(preview.errors()).isEmpty();
        assertThat(preview.derived().strands()).hasSize(2);
        assertThat(preview.derived().chapterCount()).isEqualTo(2);
        assertThat(preview.derived().lessonCount()).isEqualTo(2);
        assertThat(preview.derived().periodCount()).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from courses",Long.class)).isEqualTo(before);

        var result=service.confirm(preview.previewToken());
        assertThat(result.created()).containsEntry("strands",2).containsEntry("chapters",2).containsEntry("lessons",2).containsEntry("periods",3);
        assertThat(jdbc.queryForObject("select count(*) from program_periods p join program_strands s on s.id=p.strand_id where s.program_id=?",Integer.class,result.courseId())).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from lessons where course_id=? and name_normalized is not null",Integer.class,result.courseId())).isEqualTo(2);
    }

    private byte[] workbook(String code) throws Exception {
        try(var wb=new XSSFWorkbook();var out=new ByteArrayOutputStream()){
            var info=wb.createSheet("Thông tin");String[][] values={{"MÃ CHƯƠNG TRÌNH",code},{"TÊN CHƯƠNG TRÌNH","Toán 10 test"},{"MÔN","Toán"},{"KHỐI","10"},{"TỔNG TIẾT","3"},{"TỔNG TUẦN","35"},{"PHIÊN BẢN","1"}};for(int i=0;i<values.length;i++){var r=info.createRow(i);r.createCell(0).setCellValue(values[i][0]);r.createCell(1).setCellValue(values[i][1]);}
            var data=wb.createSheet("Dữ liệu");String[] headers={"MẠCH","TÊN MẠCH","HỌC KỲ","TIẾT","TUẦN","CHƯƠNG","TÊN CHƯƠNG","BÀI HỌC","LOẠI"};var h=data.createRow(0);for(int i=0;i<headers.length;i++)h.createCell(i).setCellValue(headers[i]);
            String[][] rows={{"DS","Đại số","1","1","1","I","Mệnh đề","Bài 1. Mệnh đề","LESSON"},{"HH","Hình học","1","1","1","IV","Lượng giác","Bài 1. Giá trị lượng giác","LESSON"},{"HH","Hình học","1","2","1","IV","Lượng giác","Bài 1. Giá trị lượng giác","LESSON"}};for(int i=0;i<rows.length;i++){var r=data.createRow(i+1);for(int j=0;j<rows[i].length;j++)r.createCell(j).setCellValue(rows[i][j]);}
            wb.write(out);return out.toByteArray();
        }
    }
}
