package com.math10.progress.service;

import com.math10.progress.dto.ProgressRequest;
import com.math10.progress.dto.ProgressResponse;

import java.util.List;

public interface ProgressService {

    ProgressResponse markOpened(ProgressRequest request);

    ProgressResponse markCompleted(ProgressRequest request);

    List<ProgressResponse> findByStudent(Long studentId);
}
