package com.math10.users.repository;

import com.math10.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameIgnoreCase(String username);

    // Native queries intentionally bypass User's @SQLRestriction so soft-deleted rows
    // protected by the database unique constraints are treated as duplicates too.
    @Query(value = "select exists(select 1 from users where lower(email) = lower(?1))", nativeQuery = true)
    boolean existsEmailIncludingDeleted(String email);

    @Query(value = "select exists(select 1 from users where lower(username) = lower(?1))", nativeQuery = true)
    boolean existsUsernameIncludingDeleted(String username);

    long countByRoleCode(String roleCode);
}
