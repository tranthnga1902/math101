package com.math10.users.repository;

import com.math10.users.entity.UserLastPosition;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLastPositionRepository extends JpaRepository<UserLastPosition, Long> {
}
