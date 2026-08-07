package com.math10;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@EnableJpaAuditing
@EnableMethodSecurity
@SpringBootApplication
public class Math10BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(Math10BackendApplication.class, args);
    }
}
