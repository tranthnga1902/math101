package com.math10.classes;

import com.math10.classes.service.ClassScheduleGenerator;
import com.math10.classes.service.ClassScheduleService;
import com.math10.common.exception.BusinessException;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider=AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class ClassDeliveryFlowTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired ClassScheduleGenerator generator;
    @Autowired ClassScheduleService progress;

    record Fixture(long classroom,long course) {}
    private Fixture fixture() {
        String code=UUID.randomUUID().toString().substring(0,8);
        long program=jdbc.queryForObject("insert into courses(code,name,status,created_at,updated_at) values(?,?,'PUBLISHED',now(),now()) returning id",Long.class,code,code);
        long template=jdbc.queryForObject("insert into program_templates(program_id,name,status,created_at,updated_at) values(?,?,'PUBLISHED',now(),now()) returning id",Long.class,program,code);
        long course=jdbc.queryForObject("insert into course_instances(template_id,name,school_year,starts_on,ends_on,status,created_at,updated_at) values(?,?,'2098','2098-01-01','2098-12-31','PUBLISHED',now(),now()) returning id",Long.class,template,code);
        long grade=jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1",Long.class);
        long classroom=jdbc.queryForObject("insert into classes(code,name,grade_id,status,start_date,created_at,updated_at) values(?,?,?,'ACTIVE','2098-01-06',now(),now()) returning id",Long.class,code,code,grade);
        jdbc.update("insert into class_courses(class_id,course_instance_id,created_at,updated_at) values(?,?,now(),now())",classroom,course);
        for(int seq=1;seq<=4;seq++)jdbc.update("insert into course_delivery_sessions(course_instance_id,seq,session_type,title,created_at,updated_at) values(?,?,'TEACHING',?,now(),now())",course,seq,"Unit "+seq);
        int dow=LocalDate.of(2098,1,6).getDayOfWeek().getValue();
        for(String time:List.of("08:00:00","14:00:00"))jdbc.update("insert into class_schedule_slots(class_id,day_of_week,start_time,duration_min,periods,created_at,updated_at) values(?,?,?::time,45,1,now(),now())",classroom,dow,time);
        return new Fixture(classroom,course);
    }

    @Test void previewMatchesGenerationAndMultipleSlots() {
        Fixture f=fixture();
        var preview=generator.preview(f.classroom());
        assertThat(jdbc.queryForObject("select count(*) from class_schedule where class_id=?",Integer.class,f.classroom())).isZero();
        assertThat(generator.generate(f.classroom())).isEqualTo(preview);
        assertThat(jdbc.queryForObject("select count(distinct scheduled_date) from class_schedule where class_id=? and deleted_at is null",Integer.class,f.classroom())).isEqualTo(2);
    }

    @Test void regenerationPreservesCompletedAndPostponedSessions() {
        Fixture f=fixture(); generator.generate(f.classroom());
        jdbc.update("update class_schedule set status='COMPLETED',completed_at=now() where class_id=? and seq=1",f.classroom());
        jdbc.update("update class_schedule set status='POSTPONED' where class_id=? and seq=2",f.classroom());
        var before=jdbc.queryForList("select id from class_schedule where class_id=? and seq<=2 order by seq",Long.class,f.classroom());
        var preview=generator.preview(f.classroom());
        assertThat(generator.generate(f.classroom())).isEqualTo(preview);
        assertThat(jdbc.queryForList("select id from class_schedule where class_id=? and seq<=2 and deleted_at is null order by seq",Long.class,f.classroom())).isEqualTo(before);
        assertThat(jdbc.queryForObject("select count(*) from class_schedule where class_id=? and deleted_at is null",Integer.class,f.classroom())).isEqualTo(4);
    }

    @Test void invalidConfigurationCannotEraseSchedule() {
        Fixture f=fixture(); generator.generate(f.classroom());
        jdbc.update("update classes set start_date=null where id=?",f.classroom());
        assertThatThrownBy(()->generator.generate(f.classroom())).isInstanceOf(BusinessException.class);
        assertThat(jdbc.queryForObject("select count(*) from class_schedule where class_id=? and deleted_at is null",Integer.class,f.classroom())).isEqualTo(4);
    }

    @Test void completingLaterSessionDoesNotCountEarlierSessionsAsTaught() {
        Fixture f=fixture(); generator.generate(f.classroom());
        jdbc.update("update class_schedule set scheduled_date=current_date-1 where class_id=?",f.classroom());
        jdbc.update("update class_schedule set status='COMPLETED',completed_at=now() where class_id=? and seq=4",f.classroom());
        var result=progress.tinhTienDo(f.classroom());
        assertThat(result.thucTe()).isEqualTo(1);
        assertThat(result.theoKeHoach()).isEqualTo(4);
        assertThat(result.lech()).isEqualTo(-3);
        assertThat(result.trangThai()).isEqualTo("BEHIND");
    }
}
