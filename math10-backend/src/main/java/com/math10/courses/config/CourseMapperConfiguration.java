package com.math10.courses.config;

import com.math10.courses.mapper.CourseMapper;
import org.mapstruct.factory.Mappers;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CourseMapperConfiguration {

    @Bean
    @ConditionalOnMissingBean(CourseMapper.class)
    public CourseMapper courseMapper() {
        return Mappers.getMapper(CourseMapper.class);
    }
}
