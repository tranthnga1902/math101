package com.math10.configuration.staging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StagingAccountSeederTest {

    @Test
    void derivesUsernameFromEmailIdentifier() {
        assertThat(StagingAccountSeeder.normalizeUsername("student.staging@math10.vn"))
                .isEqualTo("student.staging");
    }

    @Test
    void derivesEmailFromUsernameWhenMissingEmail() {
        assertThat(StagingAccountSeeder.normalizeEmail("teacher.staging"))
                .isEqualTo("teacher.staging@math10.local");
    }

    @Test
    void preservesEmailWhenIdentifierAlreadyContainsEmail() {
        assertThat(StagingAccountSeeder.normalizeEmail("student.staging@math10.vn"))
                .isEqualTo("student.staging@math10.vn");
    }
}
